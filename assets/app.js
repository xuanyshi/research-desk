// 客户端搜索 + 过滤（纯 vanilla JS，无依赖）。一套逻辑覆盖所有页：
//   搜索(#q) · 状态/来源/分数(单选按钮组) · 每日速览的疾病(单选)
//   库/精读/标签页的「疾病 + 标签」两类多选（#tagfilter，取交集）
// 疾病/标签选中后，主题标签只保留当前结果中仍可继续组合的选项。
// 所有条件按「与」组合；选中不跳转，只原地隐藏不匹配的卡片。
(function () {
  "use strict";

  // 卡片容器：库/精读/标签用 #cards，每日速览用 #papers
  var container = document.getElementById("cards") || document.getElementById("papers");
  if (!container) return;
  var items = Array.prototype.slice.call(container.children);

  var q = document.getElementById("q");
  var countEl = document.getElementById("count");
  var noResult = document.getElementById("noresult");
  var clearEl = document.getElementById("tfClear");

  var statusFilters = document.getElementById("statusFilters");
  var scoreFilters = document.getElementById("scoreFilters");
  var sourceFilters = document.getElementById("sourceFilters");
  var diseaseFilters = document.getElementById("diseaseFilters");  // 每日速览：疾病单选
  var tagfilter = document.getElementById("tagfilter");            // 库/精读/标签：疾病+标签多选

  var state = { text: "", status: "all", minScore: 0, source: "all",
                disease: "all", diseases: {}, tags: {} };

  // el 的 attr（逗号分隔的成员串）需包含 sel 里所有选中项；两侧补逗号避免子串误命中
  function memberAll(el, sel, attr) {
    var hay = "," + (el.getAttribute(attr) || "") + ",";
    for (var v in sel) {
      if (sel[v] && hay.indexOf("," + v + ",") === -1) return false;
    }
    return true;
  }

  function member(el, attr, val) {
    return ("," + (el.getAttribute(attr) || "") + ",").indexOf("," + val + ",") !== -1;
  }

  function anySel(obj) { for (var k in obj) { if (obj[k]) return true; } return false; }

  // 把主题标签变成级联选项：只显示与当前结果实际共现的标签，
  // 数字是再选该标签后可保留的篇数。已选标签始终保留，便于取消。
  function syncTagChoices(matched) {
    if (!tagfilter) return;
    Array.prototype.forEach.call(
      tagfilter.querySelectorAll('.chip-btn[data-type="tag"]'),
      function (btn) {
        var val = btn.getAttribute("data-val");
        var selected = !!state.tags[val];
        var count = 0;
        matched.forEach(function (el) {
          if (member(el, "data-tags", val)) count++;
        });
        btn.classList.toggle("hidden", !selected && count === 0);
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
        var n = btn.querySelector(".chip-n");
        if (n) n.textContent = count;
      }
    );

    // 当前条件下没有任何可选主题时，整行收起，避免只留一个空标题。
    Array.prototype.forEach.call(tagfilter.querySelectorAll(".tagfilter-row"), function (row) {
      if (!row.querySelector('.chip-btn[data-type="tag"]')) return;
      var hasVisible = Array.prototype.some.call(
        row.querySelectorAll('.chip-btn[data-type="tag"]'),
        function (btn) { return !btn.classList.contains("hidden"); }
      );
      row.classList.toggle("hidden", !hasVisible);
    });
  }

  function apply() {
    var text = state.text.trim().toLowerCase();
    var shown = 0;
    var matched = [];
    items.forEach(function (el) {
      var ok =
        (!text || (el.getAttribute("data-text") || "").indexOf(text) !== -1) &&
        (state.status === "all" || el.getAttribute("data-status") === state.status) &&
        (parseInt(el.getAttribute("data-score") || "0", 10) >= state.minScore) &&
        (state.source === "all" || el.getAttribute("data-source") === state.source) &&
        (state.disease === "all" || member(el, "data-diseases", state.disease)) &&
        memberAll(el, state.diseases, "data-diseases") &&
        memberAll(el, state.tags, "data-tags");
      el.classList.toggle("hidden", !ok);
      if (ok) { shown++; matched.push(el); }
    });
    syncTagChoices(matched);
    if (countEl) countEl.textContent = shown;
    if (noResult) noResult.classList.toggle("hidden", shown !== 0);
    if (clearEl) clearEl.classList.toggle("hidden", !(anySel(state.diseases) || anySel(state.tags)));
  }

  if (q) {
    q.addEventListener("input", function () { state.text = q.value; apply(); });
  }

  // 单选按钮组（状态/分数/来源/每日疾病）：组内互斥，点一个高亮一个
  function wireSingle(group, attr, key, parse) {
    if (!group) return;
    group.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip-btn");
      if (!btn) return;
      Array.prototype.forEach.call(group.children, function (c) { c.classList.remove("on"); });
      btn.classList.add("on");
      var v = btn.getAttribute(attr);
      state[key] = parse ? parse(v) : v;
      apply();
    });
  }
  wireSingle(statusFilters, "data-status", "status");
  wireSingle(scoreFilters, "data-min", "minScore", function (v) { return parseInt(v, 10); });
  wireSingle(sourceFilters, "data-source", "source");
  wireSingle(diseaseFilters, "data-disease", "disease");

  // 疾病 + 标签两类多选：点选切换（再点取消），全部按「与」取交集，页面不跳转
  if (tagfilter) {
    Array.prototype.forEach.call(tagfilter.querySelectorAll(".chip-btn[data-val]"), function (btn) {
      btn.setAttribute("aria-pressed", "false");
    });
    tagfilter.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip-btn");
      if (!btn || !tagfilter.contains(btn)) return;
      var val = btn.getAttribute("data-val");
      if (val == null) return;
      var bag = btn.getAttribute("data-type") === "disease" ? state.diseases : state.tags;
      if (bag[val]) { delete bag[val]; btn.classList.remove("on"); }
      else { bag[val] = true; btn.classList.add("on"); }
      btn.setAttribute("aria-pressed", bag[val] ? "true" : "false");
      apply();
    });
    if (clearEl) {
      clearEl.addEventListener("click", function () {
        state.diseases = {}; state.tags = {};
        Array.prototype.forEach.call(tagfilter.querySelectorAll(".chip-btn.on"),
          function (c) { c.classList.remove("on"); c.setAttribute("aria-pressed", "false"); });
        apply();
      });
    }
    apply();
  }
})();

// 每日速览：一键复制「收藏」命令到剪贴板，点后按钮闪一下「已复制」。
(function () {
  "use strict";

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("execCommand failed"));
      } catch (err) {
        reject(err);
      }
    });
  }

  function flash(btn, text, ok) {
    var tx = btn.querySelector(".cmd-tx");
    if (!tx) return;
    if (btn._orig == null) btn._orig = tx.textContent;
    tx.textContent = text;
    btn.classList.toggle("ok", ok);
    btn.classList.toggle("err", !ok);
    clearTimeout(btn._t);
    btn._t = setTimeout(function () {
      tx.textContent = btn._orig;
      btn.classList.remove("ok", "err");
    }, 1600);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button.cmd");
    if (!btn) return;
    var cmd = btn.getAttribute("data-copy") || "";
    copy(cmd).then(
      function () { flash(btn, btn.getAttribute("data-copied") || "✓", true); },
      function () { btn.classList.add("err"); }   // 失败就保留命令文本，方便手动选
    );
  });
})();
