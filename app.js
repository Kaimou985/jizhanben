(function () {
  var STORE_KEY = "ledger.entries.v1";
  var CATEGORY_KEY = "ledger.categories.v1";

  var defaultCategories = {
    income: ["工资", "奖金", "副业", "投资", "退款", "其他收入"],
    expense: ["餐饮", "交通", "购物", "居住", "医疗", "学习", "娱乐", "人情", "其他支出"]
  };

  var state = {
    entries: [],
    categories: cloneData(defaultCategories),
    entryType: "expense",
    selectedDay: toDateInputValue(new Date()),
    selectedMonth: toMonthInputValue(new Date())
  };

  var currency;
  var numberFormatter;
  var weekdayFormatter;
  var els = {};

  try {
    currency = new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    numberFormatter = new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    weekdayFormatter = new Intl.DateTimeFormat("zh-CN", { weekday: "short" });
  } catch (error) {
    currency = null;
    numberFormatter = null;
    weekdayFormatter = null;
  }

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    loadState();
    wireEvents();
    setEntryType("expense");
    els.dateInput.value = state.selectedDay;
    els.dayPicker.value = state.selectedDay;
    els.monthPicker.value = state.selectedMonth;
    renderAll();
    registerServiceWorker();
  }

  function cacheElements() {
    var ids = [
      "quickAddBtn",
      "seedSampleBtn",
      "todayText",
      "yearBalance",
      "yearIncome",
      "yearExpense",
      "todayIncome",
      "todayExpense",
      "monthIncome",
      "monthExpense",
      "yearMonthBars",
      "yearMonthHint",
      "entryCount",
      "recentEntries",
      "entryForm",
      "amountInput",
      "dateInput",
      "categoryInput",
      "noteInput",
      "formDayHint",
      "formDayEntries",
      "dayPicker",
      "dayIncome",
      "dayExpense",
      "dayBalance",
      "dayCategoryHint",
      "dayIncomeCategories",
      "dayExpenseCategories",
      "dayEntries",
      "dayEntryCount",
      "monthPicker",
      "selectedMonthBalance",
      "selectedMonthIncome",
      "selectedMonthExpense",
      "dailySummaryHint",
      "dailySummaryList",
      "monthCategoryHint",
      "monthIncomeCategories",
      "monthExpenseCategories",
      "monthEntries",
      "monthEntryCount",
      "incomeCategoryChips",
      "expenseCategoryChips",
      "newIncomeCategory",
      "newExpenseCategory",
      "addIncomeCategory",
      "addExpenseCategory",
      "exportJsonBtn",
      "exportCsvBtn",
      "importJsonInput",
      "clearDataBtn"
    ];

    for (var i = 0; i < ids.length; i += 1) {
      els[ids[i]] = document.getElementById(ids[i]);
    }
  }

  function wireEvents() {
    forEachNode(document.querySelectorAll("[data-target]"), function (button) {
      button.addEventListener("click", function () {
        setView(button.getAttribute("data-target"));
      });
    });

    forEachNode(document.querySelectorAll("[data-entry-type]"), function (button) {
      button.addEventListener("click", function () {
        setEntryType(button.getAttribute("data-entry-type"));
      });
    });

    els.quickAddBtn.addEventListener("click", function () {
      setView("add");
      window.setTimeout(function () {
        els.amountInput.focus();
      }, 0);
    });

    els.seedSampleBtn.addEventListener("click", addSampleData);
    els.entryForm.addEventListener("submit", saveEntry);

    els.dateInput.addEventListener("change", function () {
      renderFormDay();
    });

    els.dayPicker.addEventListener("change", function () {
      state.selectedDay = els.dayPicker.value || toDateInputValue(new Date());
      renderDay();
    });

    els.monthPicker.addEventListener("change", function () {
      state.selectedMonth = normalizeMonthValue(els.monthPicker.value) || toMonthInputValue(new Date());
      els.monthPicker.value = state.selectedMonth;
      renderMonth();
    });

    els.addIncomeCategory.addEventListener("click", function () {
      addCategory("income");
    });
    els.addExpenseCategory.addEventListener("click", function () {
      addCategory("expense");
    });
    els.exportJsonBtn.addEventListener("click", exportJson);
    els.exportCsvBtn.addEventListener("click", exportCsv);
    els.importJsonInput.addEventListener("change", importJson);
    els.clearDataBtn.addEventListener("click", clearData);

    document.body.addEventListener("click", function (event) {
      var deleteButton = closestMatch(event.target, "[data-delete-id]");
      if (deleteButton) {
        deleteEntry(deleteButton.getAttribute("data-delete-id"));
        return;
      }

      var dayButton = closestMatch(event.target, "[data-open-day]");
      if (dayButton) {
        state.selectedDay = dayButton.getAttribute("data-open-day");
        els.dayPicker.value = state.selectedDay;
        setView("day");
        renderDay();
        return;
      }

      var removeCategoryButton = closestMatch(event.target, "[data-remove-category]");
      if (removeCategoryButton) {
        removeCategory(
          removeCategoryButton.getAttribute("data-kind"),
          removeCategoryButton.getAttribute("data-remove-category")
        );
      }
    });
  }

  function loadState() {
    var storedEntries = parseJson(localStorage.getItem(STORE_KEY), []);
    var normalized = [];
    if (Array.isArray(storedEntries)) {
      for (var i = 0; i < storedEntries.length; i += 1) {
        var entry = normalizeEntry(storedEntries[i]);
        if (entry) normalized.push(entry);
      }
    }
    state.entries = normalized;

    var storedCategories = parseJson(localStorage.getItem(CATEGORY_KEY), null);
    state.categories = mergeCategories(storedCategories);
  }

  function persistEntries() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.entries));
  }

  function persistCategories() {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(state.categories));
  }

  function setView(target) {
    forEachNode(document.querySelectorAll(".view"), function (view) {
      toggleClass(view, "is-active", view.getAttribute("data-view") === target);
    });

    forEachNode(document.querySelectorAll("[data-target]"), function (button) {
      toggleClass(button, "is-active", button.getAttribute("data-target") === target);
    });

    window.scrollTo(0, 0);
  }

  function setEntryType(type) {
    state.entryType = type === "income" ? "income" : "expense";
    forEachNode(document.querySelectorAll("[data-entry-type]"), function (button) {
      toggleClass(button, "is-active", button.getAttribute("data-entry-type") === state.entryType);
    });
    renderCategoryOptions();
  }

  function saveEntry(event) {
    event.preventDefault();

    var amount = Number(els.amountInput.value);
    var date = els.dateInput.value;
    var category = els.categoryInput.value;
    var note = els.noteInput.value.replace(/^\s+|\s+$/g, "");

    if (!date || !category || !isFinite(amount) || amount <= 0) {
      alert("请填写有效的日期、分类和金额。");
      return;
    }

    var entry = {
      id: createId(),
      type: state.entryType,
      amount: roundMoney(amount),
      date: date,
      category: category,
      note: note,
      createdAt: new Date().toISOString()
    };

    state.entries.push(entry);
    persistEntries();

    state.selectedDay = date;
    state.selectedMonth = date.slice(0, 7);
    els.dayPicker.value = state.selectedDay;
    els.monthPicker.value = state.selectedMonth;
    els.entryForm.reset();
    els.dateInput.value = date;
    setEntryType(state.entryType);
    renderAll();
  }

  function deleteEntry(id) {
    var entry = null;
    for (var i = 0; i < state.entries.length; i += 1) {
      if (state.entries[i].id === id) {
        entry = state.entries[i];
        break;
      }
    }
    if (!entry) return;

    var label = entry.date + " " + typeLabel(entry.type) + " " + entry.category + " " + formatMoney(entry.amount);
    if (!confirm("删除这笔记录？\n" + label)) return;

    var nextEntries = [];
    for (var j = 0; j < state.entries.length; j += 1) {
      if (state.entries[j].id !== id) nextEntries.push(state.entries[j]);
    }
    state.entries = nextEntries;
    persistEntries();
    renderAll();
  }

  function addSampleData() {
    if (state.entries.length > 0 && !confirm("示例数据会追加到当前账本，继续添加？")) {
      return;
    }

    var today = new Date();
    var y = today.getFullYear();
    var m = today.getMonth();
    var samples = [
      { offset: 0, type: "expense", amount: 28, category: "餐饮", note: "午餐" },
      { offset: 0, type: "expense", amount: 12, category: "交通", note: "地铁" },
      { offset: 1, type: "income", amount: 8200, category: "工资", note: "本月工资" },
      { offset: 2, type: "expense", amount: 230, category: "购物", note: "日用品" },
      { offset: 4, type: "expense", amount: 1680, category: "居住", note: "房租" },
      { offset: 6, type: "income", amount: 600, category: "副业", note: "项目收入" },
      { offset: 8, type: "expense", amount: 86, category: "娱乐", note: "电影" },
      { offset: 12, type: "expense", amount: 120, category: "医疗", note: "药品" }
    ];

    for (var i = 0; i < samples.length; i += 1) {
      var sample = samples[i];
      var date = new Date(y, m, Math.max(1, today.getDate() - sample.offset));
      state.entries.push({
        id: createId(),
        type: sample.type,
        amount: sample.amount,
        date: toDateInputValue(date),
        category: sample.category,
        note: sample.note,
        createdAt: new Date().toISOString()
      });
    }

    persistEntries();
    renderAll();
  }

  function addCategory(kind) {
    var input = kind === "income" ? els.newIncomeCategory : els.newExpenseCategory;
    var value = input.value.replace(/^\s+|\s+$/g, "");
    if (!value) return;

    if (arrayIndexOf(state.categories[kind], value) !== -1) {
      alert("这个分类已经存在。");
      return;
    }

    state.categories[kind].push(value);
    input.value = "";
    persistCategories();
    renderCategoryOptions();
    renderSettings();
  }

  function removeCategory(kind, category) {
    if (!state.categories[kind] || arrayIndexOf(state.categories[kind], category) === -1) return;

    var isUsed = false;
    for (var i = 0; i < state.entries.length; i += 1) {
      if (state.entries[i].type === kind && state.entries[i].category === category) {
        isUsed = true;
        break;
      }
    }

    var message = isUsed
      ? "分类“" + category + "”已有记录使用。删除分类不会删除历史记录，但以后新增时不再显示。继续？"
      : "删除分类“" + category + "”？";

    if (!confirm(message)) return;

    var next = [];
    for (var j = 0; j < state.categories[kind].length; j += 1) {
      if (state.categories[kind][j] !== category) next.push(state.categories[kind][j]);
    }
    state.categories[kind] = next.length ? next : defaultCategories[kind].slice();
    persistCategories();
    renderCategoryOptions();
    renderSettings();
  }

  function clearData() {
    if (!state.entries.length) {
      alert("当前没有记录。");
      return;
    }

    if (!confirm("确定清空全部记账记录？此操作不可恢复。")) return;
    state.entries = [];
    persistEntries();
    renderAll();
  }

  function exportJson() {
    var payload = {
      app: "local-ledger",
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: state.categories,
      entries: getSortedEntries(state.entries)
    };

    downloadFile(
      "本地账本备份-" + toDateInputValue(new Date()) + ".json",
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8"
    );
  }

  function exportCsv() {
    var rows = [["日期", "类型", "金额", "分类", "备注", "创建时间"]];
    var sorted = getSortedEntries(state.entries);
    for (var i = 0; i < sorted.length; i += 1) {
      var entry = sorted[i];
      rows.push([
        entry.date,
        typeLabel(entry.type),
        formatNumber(entry.amount),
        entry.category,
        entry.note,
        entry.createdAt
      ]);
    }

    var lines = [];
    for (var j = 0; j < rows.length; j += 1) {
      var cells = [];
      for (var k = 0; k < rows[j].length; k += 1) {
        cells.push(escapeCsv(rows[j][k]));
      }
      lines.push(cells.join(","));
    }

    downloadFile(
      "本地账本明细-" + toDateInputValue(new Date()) + ".csv",
      "\uFEFF" + lines.join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  function importJson(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      var data = parseJson(String(reader.result), null);
      if (!data || !Array.isArray(data.entries)) {
        alert("导入失败：不是有效的账本 JSON。");
        event.target.value = "";
        return;
      }

      var importedEntries = [];
      for (var i = 0; i < data.entries.length; i += 1) {
        var entry = normalizeEntry(data.entries[i]);
        if (entry) importedEntries.push(entry);
      }

      var importedCategories = mergeCategories(data.categories);
      var shouldReplace = confirm("选择“确定”覆盖当前数据；选择“取消”则追加导入记录。");

      state.categories = importedCategories;
      state.entries = shouldReplace ? importedEntries : mergeEntries(state.entries, importedEntries);
      persistCategories();
      persistEntries();
      event.target.value = "";
      renderAll();
    };
    reader.readAsText(file, "utf-8");
  }

  function renderAll() {
    renderCategoryOptions();
    renderOverview();
    renderFormDay();
    renderDay();
    renderMonth();
    renderSettings();
  }

  function renderOverview() {
    var today = toDateInputValue(new Date());
    var thisMonth = today.slice(0, 7);
    var thisYear = today.slice(0, 4);
    var todayEntries = [];
    var monthEntries = [];
    var yearEntries = [];

    for (var i = 0; i < state.entries.length; i += 1) {
      var entry = state.entries[i];
      if (entry.date === today) todayEntries.push(entry);
      if (entry.date.slice(0, 7) === thisMonth) monthEntries.push(entry);
      if (entry.date.slice(0, 4) === thisYear && entry.date <= today) yearEntries.push(entry);
    }

    var todaySummary = summarize(todayEntries);
    var monthSummary = summarize(monthEntries);
    var yearSummary = summarize(yearEntries);

    els.todayText.textContent = formatDisplayDate(today) + "，今年统计截止今日";
    els.todayIncome.textContent = formatMoney(todaySummary.income);
    els.todayExpense.textContent = formatMoney(todaySummary.expense);
    els.monthIncome.textContent = formatMoney(monthSummary.income);
    els.monthExpense.textContent = formatMoney(monthSummary.expense);
    els.yearIncome.textContent = formatMoney(yearSummary.income);
    els.yearExpense.textContent = formatMoney(yearSummary.expense);
    els.yearBalance.textContent = formatMoney(yearSummary.balance);
    els.entryCount.textContent = state.entries.length + " 笔";

    renderEntries(els.recentEntries, getSortedEntries(state.entries).slice(0, 8));
    renderYearMonthBars(thisYear);
  }

  function renderFormDay() {
    var date = els.dateInput.value || state.selectedDay;
    var entries = getEntriesForDate(date);
    els.formDayHint.textContent = formatDisplayDate(date) + " · " + entries.length + " 笔";
    renderEntries(els.formDayEntries, entries);
  }

  function renderDay() {
    var date = state.selectedDay;
    var entries = getEntriesForDate(date);
    var summary = summarize(entries);

    els.dayIncome.textContent = formatMoney(summary.income);
    els.dayExpense.textContent = formatMoney(summary.expense);
    els.dayBalance.textContent = formatMoney(summary.balance);
    els.dayCategoryHint.textContent = formatDisplayDate(date) + " · " + entries.length + " 笔";
    els.dayEntryCount.textContent = entries.length + " 笔";

    renderCategoryBreakdown(els.dayIncomeCategories, entries, "income");
    renderCategoryBreakdown(els.dayExpenseCategories, entries, "expense");
    renderEntries(els.dayEntries, entries);
  }

  function renderMonth() {
    var month = state.selectedMonth;
    var entries = getEntriesForMonth(month);
    var summary = summarize(entries);

    els.selectedMonthIncome.textContent = formatMoney(summary.income);
    els.selectedMonthExpense.textContent = formatMoney(summary.expense);
    els.selectedMonthBalance.textContent = formatMoney(summary.balance);
    els.monthEntryCount.textContent = entries.length + " 笔";
    els.monthCategoryHint.textContent = formatMonth(month) + " · " + entries.length + " 笔";

    renderDailySummary(month, entries);
    renderCategoryBreakdown(els.monthIncomeCategories, entries, "income");
    renderCategoryBreakdown(els.monthExpenseCategories, entries, "expense");
    renderEntries(els.monthEntries, entries);
  }

  function renderSettings() {
    renderCategoryChips(els.incomeCategoryChips, "income");
    renderCategoryChips(els.expenseCategoryChips, "expense");
  }

  function renderCategoryOptions() {
    var list = state.categories[state.entryType] || [];
    var html = "";
    for (var i = 0; i < list.length; i += 1) {
      html += '<option value="' + escapeHtml(list[i]) + '">' + escapeHtml(list[i]) + "</option>";
    }
    els.categoryInput.innerHTML = html;
  }

  function renderEntries(container, entries) {
    if (!entries.length) {
      renderEmpty(container);
      return;
    }

    var html = "";
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      var type = entry.type === "income" ? "income" : "expense";
      var signedAmount = type === "income" ? formatMoney(entry.amount) : "-" + formatMoney(entry.amount);
      var note = entry.note ? " · " + escapeHtml(entry.note) : "";
      html +=
        '<article class="entry-item">' +
          '<div class="entry-main">' +
            '<div class="entry-title">' +
              '<span class="badge ' + type + '">' + typeLabel(type) + "</span>" +
              "<b>" + escapeHtml(entry.category) + "</b>" +
            "</div>" +
            '<div class="entry-meta">' + formatDisplayDate(entry.date) + note + "</div>" +
          "</div>" +
          '<div class="entry-actions">' +
            '<div class="entry-amount ' + type + '">' + signedAmount + "</div>" +
            '<button class="delete-button" type="button" data-delete-id="' + escapeHtml(entry.id) + '" aria-label="删除记录">删</button>' +
          "</div>" +
        "</article>";
    }
    container.innerHTML = html;
  }

  function renderDailySummary(month, entries) {
    var grouped = {};
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (!grouped[entry.date]) grouped[entry.date] = [];
      grouped[entry.date].push(entry);
    }

    var rows = [];
    for (var date in grouped) {
      if (Object.prototype.hasOwnProperty.call(grouped, date)) {
        var summary = summarize(grouped[date]);
        rows.push({
          date: date,
          income: summary.income,
          expense: summary.expense,
          balance: summary.balance,
          count: grouped[date].length
        });
      }
    }
    rows.sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });

    els.dailySummaryHint.textContent = formatMonth(month) + " · " + rows.length + " 天有记录";

    if (!rows.length) {
      renderEmpty(els.dailySummaryList);
      return;
    }

    var html = "";
    for (var j = 0; j < rows.length; j += 1) {
      var row = rows[j];
      html +=
        '<article class="daily-item">' +
          '<div class="daily-main">' +
            "<b>" + formatDisplayDate(row.date) + "</b>" +
            '<div class="daily-meta">' +
              '<span class="income-text">收入 ' + formatMoney(row.income) + "</span>" +
              '<span class="expense-text">支出 ' + formatMoney(row.expense) + "</span>" +
              "<span>结余 " + formatMoney(row.balance) + "</span>" +
            "</div>" +
          "</div>" +
          '<button type="button" data-open-day="' + row.date + '">' + row.count + " 笔</button>" +
        "</article>";
    }
    els.dailySummaryList.innerHTML = html;
  }

  function renderCategoryBreakdown(container, entries, kind) {
    var totals = {};
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (entry.type === kind) {
        totals[entry.category] = roundMoney((totals[entry.category] || 0) + entry.amount);
      }
    }

    var rows = [];
    for (var category in totals) {
      if (Object.prototype.hasOwnProperty.call(totals, category)) {
        rows.push({ category: category, amount: totals[category] });
      }
    }
    rows.sort(function (a, b) {
      return b.amount - a.amount;
    });

    if (!rows.length) {
      renderEmpty(container);
      return;
    }

    var max = 0;
    for (var j = 0; j < rows.length; j += 1) {
      if (rows[j].amount > max) max = rows[j].amount;
    }

    var html = "";
    for (var k = 0; k < rows.length; k += 1) {
      var row = rows[k];
      var percent = max > 0 ? Math.max(3, Math.round((row.amount / max) * 100)) : 0;
      html +=
        '<article class="category-row">' +
          '<div class="category-top">' +
            "<b>" + escapeHtml(row.category) + "</b>" +
            "<span>" + formatMoney(row.amount) + "</span>" +
          "</div>" +
          '<div class="bar-track">' +
            '<div class="bar-fill ' + kind + '" style="--width: ' + percent + '%"></div>' +
          "</div>" +
        "</article>";
    }
    container.innerHTML = html;
  }

  function renderCategoryChips(container, kind) {
    var list = state.categories[kind] || [];
    var html = "";
    for (var i = 0; i < list.length; i += 1) {
      var category = list[i];
      html +=
        '<span class="chip">' +
          "<span>" + escapeHtml(category) + "</span>" +
          '<button type="button" data-kind="' + kind + '" data-remove-category="' + escapeHtml(category) + '" aria-label="删除' + escapeHtml(category) + '">×</button>' +
        "</span>";
    }
    container.innerHTML = html;
  }

  function renderYearMonthBars(year) {
    var rows = [];
    for (var month = 1; month <= 12; month += 1) {
      var key = year + "-" + pad2(month);
      var entries = getEntriesForMonth(key);
      var summary = summarize(entries);
      rows.push({
        month: month,
        key: key,
        income: summary.income,
        expense: summary.expense,
        balance: summary.balance
      });
    }

    var max = 1;
    for (var i = 0; i < rows.length; i += 1) {
      max = Math.max(max, rows[i].income, rows[i].expense);
    }

    els.yearMonthHint.textContent = year + " 年";
    var html = "";
    for (var j = 0; j < rows.length; j += 1) {
      var row = rows[j];
      var incomeWidth = Math.round((row.income / max) * 100);
      var expenseWidth = Math.round((row.expense / max) * 100);
      html +=
        '<div class="month-bar-row">' +
          '<div class="month-bar-label">' + row.month + "月</div>" +
          '<div class="month-bar-track" aria-label="' + row.month + '月收入支出">' +
            '<div class="month-line"><span class="income" style="--width: ' + incomeWidth + '%"></span></div>' +
            '<div class="month-line"><span class="expense" style="--width: ' + expenseWidth + '%"></span></div>' +
          "</div>" +
          '<div class="month-bar-total">' + formatMoney(row.balance) + "</div>" +
        "</div>";
    }
    els.yearMonthBars.innerHTML = html;
  }

  function renderEmpty(container) {
    container.innerHTML = document.getElementById("emptyTemplate").innerHTML;
  }

  function summarize(entries) {
    var result = { income: 0, expense: 0, balance: 0 };
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (entry.type === "income") {
        result.income = roundMoney(result.income + entry.amount);
      } else {
        result.expense = roundMoney(result.expense + entry.amount);
      }
      result.balance = roundMoney(result.income - result.expense);
    }
    return result;
  }

  function getEntriesForDate(date) {
    var entries = [];
    for (var i = 0; i < state.entries.length; i += 1) {
      if (state.entries[i].date === date) entries.push(state.entries[i]);
    }
    return getSortedEntries(entries);
  }

  function getEntriesForMonth(month) {
    var entries = [];
    for (var i = 0; i < state.entries.length; i += 1) {
      if (state.entries[i].date.slice(0, 7) === month) entries.push(state.entries[i]);
    }
    return getSortedEntries(entries);
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    var amount = Number(entry.amount);
    var date = String(entry.date || "");
    var type = entry.type === "income" ? "income" : entry.type === "expense" ? "expense" : null;
    var category = String(entry.category || "").replace(/^\s+|\s+$/g, "");

    if (!type || !isDateInputValue(date) || !isFinite(amount) || amount <= 0 || !category) {
      return null;
    }

    return {
      id: String(entry.id || createId()),
      type: type,
      amount: roundMoney(amount),
      date: date,
      category: category,
      note: String(entry.note || "").replace(/^\s+|\s+$/g, "").slice(0, 80),
      createdAt: String(entry.createdAt || new Date().toISOString())
    };
  }

  function mergeEntries(current, imported) {
    var byId = {};
    var result = [];

    for (var i = 0; i < current.length; i += 1) {
      byId[current[i].id] = result.length;
      result.push(current[i]);
    }

    for (var j = 0; j < imported.length; j += 1) {
      var entry = imported[j];
      if (typeof byId[entry.id] === "number") {
        result[byId[entry.id]] = entry;
      } else {
        byId[entry.id] = result.length;
        result.push(entry);
      }
    }

    return result;
  }

  function mergeCategories(source) {
    var result = cloneData(defaultCategories);
    if (!source || typeof source !== "object") return result;

    mergeCategoryList(result, source, "income");
    mergeCategoryList(result, source, "expense");
    return result;
  }

  function mergeCategoryList(result, source, kind) {
    if (!Array.isArray(source[kind])) return;
    for (var i = 0; i < source[kind].length; i += 1) {
      var item = String(source[kind][i] || "").replace(/^\s+|\s+$/g, "");
      if (item && arrayIndexOf(result[kind], item) === -1) {
        result[kind].push(item);
      }
    }
  }

  function getSortedEntries(entries) {
    return entries.slice().sort(function (a, b) {
      var dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function downloadFile(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {
        return null;
      });
    });
  }

  function createId() {
    return String(new Date().getTime()) + "-" + String(Math.random()).slice(2);
  }

  function typeLabel(type) {
    return type === "income" ? "收入" : "支出";
  }

  function formatMoney(value) {
    if (currency) return currency.format(value || 0);
    return "¥" + formatNumber(value || 0);
  }

  function formatNumber(value) {
    if (numberFormatter) return numberFormatter.format(value || 0);
    return Number(value || 0).toFixed(2);
  }

  function formatMonth(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return "--";
    var parts = month.split("-");
    return parts[0] + "年" + Number(parts[1]) + "月";
  }

  function formatDisplayDate(dateValue) {
    if (!isDateInputValue(dateValue)) return "--";
    var parts = dateValue.split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(year, month - 1, day);
    var weekday = weekdayFormatter ? " " + weekdayFormatter.format(date) : "";
    return month + "月" + day + "日" + weekday;
  }

  function toDateInputValue(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function toMonthInputValue(date) {
    return toDateInputValue(date).slice(0, 7);
  }

  function normalizeMonthValue(value) {
    if (/^\d{4}-\d{2}$/.test(value)) return value;
    if (/^\d{4}-\d{1}$/.test(value)) return value.slice(0, 5) + "0" + value.slice(5);
    return "";
  }

  function isDateInputValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var parts = value.split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function pad2(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function roundMoney(value) {
    return Math.round((Number(value) + 0.0000001) * 100) / 100;
  }

  function parseJson(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeCsv(value) {
    var text = value === null || typeof value === "undefined" ? "" : String(value);
    if (/[",\n\r]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function arrayIndexOf(list, value) {
    for (var i = 0; i < list.length; i += 1) {
      if (list[i] === value) return i;
    }
    return -1;
  }

  function forEachNode(nodes, callback) {
    for (var i = 0; i < nodes.length; i += 1) {
      callback(nodes[i], i);
    }
  }

  function toggleClass(element, className, enabled) {
    if (enabled) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  }

  function closestMatch(element, selector) {
    while (element && element !== document) {
      if (matchesSelector(element, selector)) return element;
      element = element.parentNode;
    }
    return null;
  }

  function matchesSelector(element, selector) {
    var matcher =
      element.matches ||
      element.webkitMatchesSelector ||
      element.msMatchesSelector ||
      element.mozMatchesSelector;
    return matcher ? matcher.call(element, selector) : false;
  }
})();
