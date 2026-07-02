(function () {
  var STORE_KEY = "ledger.entries.v1";
  var CATEGORY_KEY = "ledger.categories.v1";
  var DAILY_TOTAL_KEY = "ledger.dailyTotals.v1";
  var MONTHLY_TOTAL_KEY = "ledger.monthlyTotals.v1";
  var SAVINGS_KEY = "ledger.savings.v1";

  var defaultCategories = {
    income: ["工资", "奖金", "副业", "投资", "退款", "其他收入"],
    expense: ["餐饮", "交通", "购物", "居住", "医疗", "学习", "娱乐", "人情", "其他支出"]
  };

  var state = {
    entries: [],
    dailyTotals: [],
    monthlyTotals: [],
    savings: [],
    categories: cloneData(defaultCategories),
    entryType: "expense",
    selectedDay: toDateInputValue(new Date()),
    selectedMonth: toMonthInputValue(new Date()),
    overviewStatPeriod: "day"
  };

  var currency;
  var numberFormatter;
  var weekdayFormatter;
  var els = {};
  var pickerControls = [];
  var activeOverviewPicker = null;

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
    els.dailyTotalDate.value = state.selectedDay;
    els.monthlyTotalMonth.value = state.selectedMonth;
    els.overviewStatDay.value = state.selectedDay;
    els.overviewStatMonth.value = state.selectedMonth;
    els.overviewStatYear.value = state.selectedDay.slice(0, 4);
    els.overviewPieDay.value = state.selectedDay;
    els.overviewPieMonth.value = state.selectedMonth;
    els.overviewPieYear.value = state.selectedDay.slice(0, 4);
    els.savingsDate.value = state.selectedDay;
    setupPickerControls();
    renderAll();
    registerServiceWorker();
  }

  function cacheElements() {
    var ids = [
      "quickAddBtn",
      "seedSampleBtn",
      "todayText",
      "overviewStatPickerButton",
      "overviewBalanceLabel",
      "overviewStatDay",
      "overviewStatMonth",
      "overviewStatYear",
      "yearBalance",
      "yearIncome",
      "yearExpense",
      "comparePieHint",
      "overviewPieDay",
      "overviewPieMonth",
      "overviewPieYear",
      "todayPieHint",
      "todayComparePie",
      "monthPieHint",
      "monthComparePie",
      "yearPieHint",
      "yearComparePie",
      "overviewPickerModal",
      "overviewPickerBackdrop",
      "overviewPickerTitle",
      "overviewPickerClose",
      "overviewPickerRow",
      "overviewPickerYear",
      "overviewPickerMonth",
      "overviewPickerDay",
      "overviewPickerCancel",
      "overviewPickerConfirm",
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
      "dailyTotalForm",
      "dailyTotalDate",
      "dailyTotalIncome",
      "dailyTotalExpense",
      "dailyTotalNote",
      "monthlyTotalForm",
      "monthlyTotalMonth",
      "monthlyTotalIncome",
      "monthlyTotalExpense",
      "monthlyTotalNote",
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
      "savingsForm",
      "savingsDate",
      "savingsAmount",
      "savingsNote",
      "latestSavingsAmount",
      "latestSavingsMeta",
      "savingsCount",
      "savingsHistory",
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

    forEachNode(document.querySelectorAll("[data-stat-period]"), function (button) {
      button.addEventListener("click", function () {
        state.overviewStatPeriod = button.getAttribute("data-stat-period") || "day";
        renderOverviewStats();
      });
    });

    forEachNode(document.querySelectorAll("[data-overview-picker-target]"), function (button) {
      button.addEventListener("click", function () {
        openOverviewPicker(button);
      });
    });

    els.overviewPickerBackdrop.addEventListener("click", closeOverviewPicker);
    els.overviewPickerClose.addEventListener("click", closeOverviewPicker);
    els.overviewPickerCancel.addEventListener("click", closeOverviewPicker);
    els.overviewPickerConfirm.addEventListener("click", confirmOverviewPicker);
    els.overviewPickerYear.addEventListener("change", syncOverviewPickerDays);
    els.overviewPickerMonth.addEventListener("change", syncOverviewPickerDays);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && activeOverviewPicker) closeOverviewPicker();
    });

    els.quickAddBtn.addEventListener("click", function () {
      setView("add");
      window.setTimeout(function () {
        els.amountInput.focus();
      }, 0);
    });

    els.seedSampleBtn.addEventListener("click", addSampleData);
    els.entryForm.addEventListener("submit", saveEntry);
    els.dailyTotalForm.addEventListener("submit", saveDailyTotal);
    els.monthlyTotalForm.addEventListener("submit", saveMonthlyTotal);
    els.savingsForm.addEventListener("submit", saveSavings);

    bindOverviewPicker(els.overviewStatDay, "date", renderOverviewStats);
    bindOverviewPicker(els.overviewStatMonth, "month", renderOverviewStats);
    bindOverviewPicker(els.overviewStatYear, "year", renderOverviewStats);
    bindOverviewPicker(els.overviewPieDay, "date", renderOverviewCharts);
    bindOverviewPicker(els.overviewPieMonth, "month", renderOverviewCharts);
    bindOverviewPicker(els.overviewPieYear, "year", renderOverviewCharts);
    bindOverviewPicker(els.savingsDate, "date", function () {});

    els.dailyTotalDate.addEventListener("change", function () {
      els.dailyTotalDate.value = normalizeDateValue(els.dailyTotalDate.value) || state.selectedDay;
      syncPickerByTarget("dailyTotalDate");
    });
    els.dailyTotalDate.addEventListener("blur", function () {
      els.dailyTotalDate.value = normalizeDateValue(els.dailyTotalDate.value) || state.selectedDay;
      syncPickerByTarget("dailyTotalDate");
    });
    els.monthlyTotalMonth.addEventListener("change", function () {
      els.monthlyTotalMonth.value = normalizeMonthValue(els.monthlyTotalMonth.value) || state.selectedMonth;
      syncPickerByTarget("monthlyTotalMonth");
    });
    els.monthlyTotalMonth.addEventListener("blur", function () {
      els.monthlyTotalMonth.value = normalizeMonthValue(els.monthlyTotalMonth.value) || state.selectedMonth;
      syncPickerByTarget("monthlyTotalMonth");
    });

    els.dateInput.addEventListener("change", function () {
      els.dateInput.value = normalizeDateValue(els.dateInput.value) || state.selectedDay;
      if (els.dateInput.value) els.dailyTotalDate.value = els.dateInput.value;
      syncPickerByTarget("dateInput");
      syncPickerByTarget("dailyTotalDate");
      renderFormDay();
    });
    els.dateInput.addEventListener("blur", function () {
      els.dateInput.value = normalizeDateValue(els.dateInput.value) || state.selectedDay;
      syncPickerByTarget("dateInput");
      renderFormDay();
    });

    els.dayPicker.addEventListener("change", function () {
      state.selectedDay = normalizeDateValue(els.dayPicker.value) || toDateInputValue(new Date());
      els.dayPicker.value = state.selectedDay;
      syncPickerByTarget("dayPicker");
      renderDay();
    });
    els.dayPicker.addEventListener("blur", function () {
      state.selectedDay = normalizeDateValue(els.dayPicker.value) || state.selectedDay;
      els.dayPicker.value = state.selectedDay;
      syncPickerByTarget("dayPicker");
      renderDay();
    });

    els.monthPicker.addEventListener("change", function () {
      state.selectedMonth = normalizeMonthValue(els.monthPicker.value) || toMonthInputValue(new Date());
      els.monthPicker.value = state.selectedMonth;
      els.monthlyTotalMonth.value = state.selectedMonth;
      syncPickerByTarget("monthPicker");
      syncPickerByTarget("monthlyTotalMonth");
      renderMonth();
    });
    els.monthPicker.addEventListener("blur", function () {
      state.selectedMonth = normalizeMonthValue(els.monthPicker.value) || state.selectedMonth;
      els.monthPicker.value = state.selectedMonth;
      els.monthlyTotalMonth.value = state.selectedMonth;
      syncPickerByTarget("monthPicker");
      syncPickerByTarget("monthlyTotalMonth");
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

      var totalDeleteButton = closestMatch(event.target, "[data-delete-total-id]");
      if (totalDeleteButton) {
        deleteTotal(
          totalDeleteButton.getAttribute("data-total-kind"),
          totalDeleteButton.getAttribute("data-delete-total-id")
        );
        return;
      }

      var savingsDeleteButton = closestMatch(event.target, "[data-delete-savings-id]");
      if (savingsDeleteButton) {
        deleteSavings(savingsDeleteButton.getAttribute("data-delete-savings-id"));
        return;
      }

      var dayButton = closestMatch(event.target, "[data-open-day]");
      if (dayButton) {
        state.selectedDay = dayButton.getAttribute("data-open-day");
        els.dayPicker.value = state.selectedDay;
        syncPickerByTarget("dayPicker");
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

  function setupPickerControls() {
    pickerControls = [];

    forEachNode(document.querySelectorAll("[data-date-target]"), function (picker) {
      createDatePicker(picker);
    });

    forEachNode(document.querySelectorAll("[data-month-target]"), function (picker) {
      createMonthPicker(picker);
    });

    forEachNode(document.querySelectorAll("[data-year-target]"), function (picker) {
      createYearPicker(picker);
    });

    syncAllPickerControls();
  }

  function createDatePicker(picker) {
    var targetId = picker.getAttribute("data-date-target");
    var target = document.getElementById(targetId);
    var yearSelect = picker.querySelector('[data-picker="year"]');
    var monthSelect = picker.querySelector('[data-picker="month"]');
    var daySelect = picker.querySelector('[data-picker="day"]');
    var value = normalizeDateValue(target.value) || state.selectedDay || toDateInputValue(new Date());
    var parts = value.split("-");

    fillYearOptions(yearSelect, Number(parts[0]));
    fillMonthOptions(monthSelect);
    yearSelect.value = parts[0];
    monthSelect.value = parts[1];
    fillDayOptions(daySelect, Number(parts[0]), Number(parts[1]), Number(parts[2]));
    daySelect.value = parts[2];

    var control = {
      kind: "date",
      targetId: targetId,
      target: target,
      picker: picker,
      yearSelect: yearSelect,
      monthSelect: monthSelect,
      daySelect: daySelect
    };
    pickerControls.push(control);

    var onChange = function () {
      var year = Number(yearSelect.value);
      var month = Number(monthSelect.value);
      var currentDay = Number(daySelect.value);
      fillDayOptions(daySelect, year, month, currentDay);
      target.value = yearSelect.value + "-" + monthSelect.value + "-" + daySelect.value;
      triggerChange(target);
    };

    yearSelect.addEventListener("change", onChange);
    monthSelect.addEventListener("change", onChange);
    daySelect.addEventListener("change", onChange);
  }

  function createMonthPicker(picker) {
    var targetId = picker.getAttribute("data-month-target");
    var target = document.getElementById(targetId);
    var yearSelect = picker.querySelector('[data-picker="year"]');
    var monthSelect = picker.querySelector('[data-picker="month"]');
    var value = normalizeMonthValue(target.value) || state.selectedMonth || toMonthInputValue(new Date());
    var parts = value.split("-");

    fillYearOptions(yearSelect, Number(parts[0]));
    fillMonthOptions(monthSelect);
    yearSelect.value = parts[0];
    monthSelect.value = parts[1];

    var control = {
      kind: "month",
      targetId: targetId,
      target: target,
      picker: picker,
      yearSelect: yearSelect,
      monthSelect: monthSelect
    };
    pickerControls.push(control);

    var onChange = function () {
      target.value = yearSelect.value + "-" + monthSelect.value;
      triggerChange(target);
    };

    yearSelect.addEventListener("change", onChange);
    monthSelect.addEventListener("change", onChange);
  }

  function createYearPicker(picker) {
    var targetId = picker.getAttribute("data-year-target");
    var target = document.getElementById(targetId);
    var yearSelect = picker.querySelector('[data-picker="year"]');
    var value = normalizeYearValue(target.value) || String(new Date().getFullYear());

    fillYearOptions(yearSelect, Number(value));
    yearSelect.value = value;

    pickerControls.push({
      kind: "year",
      targetId: targetId,
      target: target,
      picker: picker,
      yearSelect: yearSelect
    });

    yearSelect.addEventListener("change", function () {
      target.value = yearSelect.value;
      triggerChange(target);
    });
  }

  function bindOverviewPicker(input, kind, callback) {
    input.addEventListener("change", function () {
      var fallback = kind === "date"
        ? toDateInputValue(new Date())
        : kind === "month"
          ? toMonthInputValue(new Date())
          : String(new Date().getFullYear());
      var normalized = kind === "date"
        ? normalizeDateValue(input.value)
        : kind === "month"
          ? normalizeMonthValue(input.value)
          : normalizeYearValue(input.value);
      input.value = normalized || fallback;
      syncPickerByTarget(input.id);
      callback();
    });
  }

  function openOverviewPicker(button) {
    var targetId = button.getAttribute("data-overview-picker-target");
    var kind = button.getAttribute("data-overview-picker-kind") || "date";
    var target = document.getElementById(targetId);
    if (!target) return;

    var today = toDateInputValue(new Date());
    var value;
    if (kind === "year") {
      value = (normalizeYearValue(target.value) || today.slice(0, 4)) + "-01-01";
    } else if (kind === "month") {
      value = (normalizeMonthValue(target.value) || today.slice(0, 7)) + "-01";
    } else {
      value = normalizeDateValue(target.value) || today;
    }

    var parts = value.split("-");
    fillYearOptions(els.overviewPickerYear, Number(parts[0]));
    fillMonthOptions(els.overviewPickerMonth);
    els.overviewPickerYear.value = parts[0];
    els.overviewPickerMonth.value = parts[1];
    fillDayOptions(els.overviewPickerDay, Number(parts[0]), Number(parts[1]), Number(parts[2]));
    els.overviewPickerDay.value = parts[2];

    activeOverviewPicker = {
      target: target,
      kind: kind,
      trigger: button
    };
    els.overviewPickerTitle.textContent = button.getAttribute("data-overview-picker-title") || "选择日期";
    els.overviewPickerRow.setAttribute("data-kind", kind);
    els.overviewPickerModal.hidden = false;
    button.setAttribute("aria-expanded", "true");
    document.body.classList.add("modal-open");
    window.setTimeout(function () {
      els.overviewPickerYear.focus();
    }, 0);
  }

  function closeOverviewPicker() {
    if (activeOverviewPicker && activeOverviewPicker.trigger) {
      activeOverviewPicker.trigger.setAttribute("aria-expanded", "false");
      activeOverviewPicker.trigger.focus();
    }
    activeOverviewPicker = null;
    els.overviewPickerModal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function confirmOverviewPicker() {
    if (!activeOverviewPicker) return;

    var value = els.overviewPickerYear.value;
    if (activeOverviewPicker.kind !== "year") value += "-" + els.overviewPickerMonth.value;
    if (activeOverviewPicker.kind === "date") value += "-" + els.overviewPickerDay.value;

    var target = activeOverviewPicker.target;
    target.value = value;
    closeOverviewPicker();
    triggerChange(target);
  }

  function syncOverviewPickerDays() {
    if (!activeOverviewPicker || activeOverviewPicker.kind !== "date") return;
    fillDayOptions(
      els.overviewPickerDay,
      Number(els.overviewPickerYear.value),
      Number(els.overviewPickerMonth.value),
      Number(els.overviewPickerDay.value)
    );
  }

  function configureOverviewStatTrigger(targetId, kind, title, label) {
    els.overviewStatPickerButton.setAttribute("data-overview-picker-target", targetId);
    els.overviewStatPickerButton.setAttribute("data-overview-picker-kind", kind);
    els.overviewStatPickerButton.setAttribute("data-overview-picker-title", title);
    els.overviewStatPickerButton.textContent = label;
  }

  function syncAllPickerControls() {
    for (var i = 0; i < pickerControls.length; i += 1) {
      syncPickerControl(pickerControls[i]);
    }
  }

  function syncPickerByTarget(targetId) {
    for (var i = 0; i < pickerControls.length; i += 1) {
      if (pickerControls[i].targetId === targetId) {
        syncPickerControl(pickerControls[i]);
      }
    }
  }

  function syncPickerControl(control) {
    if (control.kind === "date") {
      var dateValue = normalizeDateValue(control.target.value) || state.selectedDay || toDateInputValue(new Date());
      var dateParts = dateValue.split("-");
      ensureYearOption(control.yearSelect, Number(dateParts[0]));
      control.yearSelect.value = dateParts[0];
      control.monthSelect.value = dateParts[1];
      fillDayOptions(control.daySelect, Number(dateParts[0]), Number(dateParts[1]), Number(dateParts[2]));
      control.daySelect.value = dateParts[2];
      control.target.value = dateValue;
      return;
    }

    if (control.kind === "year") {
      var yearValue = normalizeYearValue(control.target.value) || String(new Date().getFullYear());
      ensureYearOption(control.yearSelect, Number(yearValue));
      control.yearSelect.value = yearValue;
      control.target.value = yearValue;
      return;
    }

    var monthValue = normalizeMonthValue(control.target.value) || state.selectedMonth || toMonthInputValue(new Date());
    var monthParts = monthValue.split("-");
    ensureYearOption(control.yearSelect, Number(monthParts[0]));
    control.yearSelect.value = monthParts[0];
    control.monthSelect.value = monthParts[1];
    control.target.value = monthValue;
  }

  function fillYearOptions(select, selectedYear) {
    var currentYear = new Date().getFullYear();
    var start = Math.min(currentYear - 15, selectedYear);
    var end = Math.max(currentYear + 5, selectedYear);
    var html = "";
    for (var year = start; year <= end; year += 1) {
      html += '<option value="' + year + '">' + year + "年</option>";
    }
    select.innerHTML = html;
  }

  function ensureYearOption(select, year) {
    if (!select.querySelector('option[value="' + year + '"]')) {
      fillYearOptions(select, year);
    }
  }

  function fillMonthOptions(select) {
    var html = "";
    for (var month = 1; month <= 12; month += 1) {
      html += '<option value="' + pad2(month) + '">' + month + "月</option>";
    }
    select.innerHTML = html;
  }

  function fillDayOptions(select, year, month, selectedDay) {
    var maxDay = new Date(year, month, 0).getDate();
    var day = Math.min(Math.max(Number(selectedDay) || 1, 1), maxDay);
    var html = "";
    for (var i = 1; i <= maxDay; i += 1) {
      html += '<option value="' + pad2(i) + '">' + i + "日</option>";
    }
    select.innerHTML = html;
    select.value = pad2(day);
  }

  function triggerChange(target) {
    if (typeof Event === "function") {
      target.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      var event = document.createEvent("Event");
      event.initEvent("change", true, true);
      target.dispatchEvent(event);
    }
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

    state.dailyTotals = normalizeTotals(parseJson(localStorage.getItem(DAILY_TOTAL_KEY), []), "daily");
    state.monthlyTotals = normalizeTotals(parseJson(localStorage.getItem(MONTHLY_TOTAL_KEY), []), "monthly");
    state.savings = normalizeSavingsList(parseJson(localStorage.getItem(SAVINGS_KEY), []));

    var storedCategories = parseJson(localStorage.getItem(CATEGORY_KEY), null);
    state.categories = mergeCategories(storedCategories);
  }

  function persistEntries() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.entries));
  }

  function persistCategories() {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(state.categories));
  }

  function persistDailyTotals() {
    localStorage.setItem(DAILY_TOTAL_KEY, JSON.stringify(state.dailyTotals));
  }

  function persistMonthlyTotals() {
    localStorage.setItem(MONTHLY_TOTAL_KEY, JSON.stringify(state.monthlyTotals));
  }

  function persistSavings() {
    localStorage.setItem(SAVINGS_KEY, JSON.stringify(state.savings));
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
    var date = normalizeDateValue(els.dateInput.value);
    var category = els.categoryInput.value;
    var note = els.noteInput.value.replace(/^\s+|\s+$/g, "");

    if (!date || !category || !isFinite(amount) || amount <= 0) {
      alert("请填写有效的日期、分类和金额。日期格式例如：2026-07-02。");
      return;
    }
    els.dateInput.value = date;

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
    els.dailyTotalDate.value = date;
    els.monthlyTotalMonth.value = state.selectedMonth;
    setEntryType(state.entryType);
    renderAll();
  }

  function saveDailyTotal(event) {
    event.preventDefault();

    var date = normalizeDateValue(els.dailyTotalDate.value);
    var income = readMoneyInput(els.dailyTotalIncome);
    var expense = readMoneyInput(els.dailyTotalExpense);
    var note = els.dailyTotalNote.value.replace(/^\s+|\s+$/g, "");

    if (!isDateInputValue(date) || (income <= 0 && expense <= 0)) {
      alert("请填写有效日期，并至少填写总收入或总支出中的一项。日期格式例如：2026-07-02。");
      return;
    }
    els.dailyTotalDate.value = date;

    state.dailyTotals.push({
      id: createId(),
      date: date,
      income: income,
      expense: expense,
      note: note,
      createdAt: new Date().toISOString()
    });

    persistDailyTotals();
    state.selectedDay = date;
    state.selectedMonth = date.slice(0, 7);
    els.dayPicker.value = state.selectedDay;
    els.monthPicker.value = state.selectedMonth;
    els.monthlyTotalMonth.value = state.selectedMonth;
    els.dailyTotalForm.reset();
    els.dailyTotalDate.value = date;
    renderAll();
  }

  function saveMonthlyTotal(event) {
    event.preventDefault();

    var month = normalizeMonthValue(els.monthlyTotalMonth.value);
    var income = readMoneyInput(els.monthlyTotalIncome);
    var expense = readMoneyInput(els.monthlyTotalExpense);
    var note = els.monthlyTotalNote.value.replace(/^\s+|\s+$/g, "");

    if (!month || (income <= 0 && expense <= 0)) {
      alert("请选择月份，并至少填写总收入或总支出中的一项。");
      return;
    }

    state.monthlyTotals.push({
      id: createId(),
      month: month,
      income: income,
      expense: expense,
      note: note,
      createdAt: new Date().toISOString()
    });

    persistMonthlyTotals();
    state.selectedMonth = month;
    els.monthPicker.value = state.selectedMonth;
    els.monthlyTotalForm.reset();
    els.monthlyTotalMonth.value = month;
    renderAll();
  }

  function saveSavings(event) {
    event.preventDefault();

    var date = normalizeDateValue(els.savingsDate.value);
    var amount = Number(els.savingsAmount.value);
    var note = els.savingsNote.value.replace(/^\s+|\s+$/g, "");

    if (!date || !isFinite(amount) || amount < 0) {
      alert("请选择有效日期，并填写不小于 0 的总存款金额。");
      return;
    }

    state.savings.push({
      id: createId(),
      date: date,
      amount: roundMoney(amount),
      note: note,
      createdAt: new Date().toISOString()
    });
    persistSavings();

    els.savingsForm.reset();
    els.savingsDate.value = date;
    syncPickerByTarget("savingsDate");
    renderSavings();
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

  function deleteTotal(kind, id) {
    var list = kind === "monthly" ? state.monthlyTotals : state.dailyTotals;
    var total = null;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) {
        total = list[i];
        break;
      }
    }
    if (!total) return;

    var title = kind === "monthly" ? formatMonth(total.month) + " 每月总账" : formatDisplayDate(total.date) + " 每天总账";
    if (!confirm("删除这条总账？\n" + title)) return;

    var next = [];
    for (var j = 0; j < list.length; j += 1) {
      if (list[j].id !== id) next.push(list[j]);
    }

    if (kind === "monthly") {
      state.monthlyTotals = next;
      persistMonthlyTotals();
    } else {
      state.dailyTotals = next;
      persistDailyTotals();
    }
    renderAll();
  }

  function deleteSavings(id) {
    var record = null;
    for (var i = 0; i < state.savings.length; i += 1) {
      if (state.savings[i].id === id) {
        record = state.savings[i];
        break;
      }
    }
    if (!record) return;
    if (!confirm("删除这条存款记录？\n" + formatDisplayDate(record.date) + " " + formatMoney(record.amount))) return;

    var next = [];
    for (var j = 0; j < state.savings.length; j += 1) {
      if (state.savings[j].id !== id) next.push(state.savings[j]);
    }
    state.savings = next;
    persistSavings();
    renderSavings();
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
    if (!state.entries.length && !state.dailyTotals.length && !state.monthlyTotals.length && !state.savings.length) {
      alert("当前没有记录。");
      return;
    }

    if (!confirm("确定清空全部记账和存款记录？此操作不可恢复。")) return;
    state.entries = [];
    state.dailyTotals = [];
    state.monthlyTotals = [];
    state.savings = [];
    persistEntries();
    persistDailyTotals();
    persistMonthlyTotals();
    persistSavings();
    renderAll();
  }

  function exportJson() {
    var payload = {
      app: "local-ledger",
      version: 3,
      exportedAt: new Date().toISOString(),
      categories: state.categories,
      entries: getSortedEntries(state.entries),
      dailyTotals: getSortedDailyTotals(state.dailyTotals),
      monthlyTotals: getSortedMonthlyTotals(state.monthlyTotals),
      savings: getSortedSavings(state.savings)
    };

    downloadFile(
      "本地账本备份-" + toDateInputValue(new Date()) + ".json",
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8"
    );
  }

  function exportCsv() {
    var rows = [["日期/月份", "来源", "类型", "金额", "分类", "备注", "创建时间"]];
    var sorted = getSortedLedgerItems(getAllLedgerItems());
    for (var i = 0; i < sorted.length; i += 1) {
      var entry = sorted[i];
      rows.push([
        entry.scope === "monthly" ? entry.month : entry.date,
        sourceLabel(entry.scope),
        typeLabel(entry.type),
        formatNumber(entry.amount),
        entry.category,
        entry.note,
        entry.createdAt
      ]);
    }
    var savings = getSortedSavings(state.savings);
    for (var s = 0; s < savings.length; s += 1) {
      rows.push([
        savings[s].date,
        "总存款",
        "存款快照",
        formatNumber(savings[s].amount),
        "总存款",
        savings[s].note,
        savings[s].createdAt
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
      var importedDailyTotals = normalizeTotals(data.dailyTotals || [], "daily");
      var importedMonthlyTotals = normalizeTotals(data.monthlyTotals || [], "monthly");
      var importedSavings = normalizeSavingsList(data.savings || []);
      var shouldReplace = confirm("选择“确定”覆盖当前数据；选择“取消”则追加导入记录。");

      state.categories = importedCategories;
      state.entries = shouldReplace ? importedEntries : mergeEntries(state.entries, importedEntries);
      state.dailyTotals = shouldReplace ? importedDailyTotals : mergeTotals(state.dailyTotals, importedDailyTotals);
      state.monthlyTotals = shouldReplace ? importedMonthlyTotals : mergeTotals(state.monthlyTotals, importedMonthlyTotals);
      state.savings = shouldReplace ? importedSavings : mergeTotals(state.savings, importedSavings);
      persistCategories();
      persistEntries();
      persistDailyTotals();
      persistMonthlyTotals();
      persistSavings();
      event.target.value = "";
      renderAll();
    };
    reader.readAsText(file, "utf-8");
  }

  function renderAll() {
    syncAllPickerControls();
    renderCategoryOptions();
    renderOverview();
    renderFormDay();
    renderDay();
    renderMonth();
    renderSavings();
    renderSettings();
  }

  function renderOverview() {
    els.todayText.textContent = "今天 · " + formatDisplayDate(toDateInputValue(new Date()));
    els.entryCount.textContent = getLedgerRecordCount() + " 条";
    renderOverviewStats();
    renderOverviewCharts();
    renderEntries(els.recentEntries, getSortedLedgerItems(getAllLedgerItems()).slice(0, 8));
  }

  function renderOverviewStats() {
    var period = state.overviewStatPeriod;
    var entries;
    var hint;
    var balanceLabel;

    forEachNode(document.querySelectorAll("[data-stat-period]"), function (button) {
      toggleClass(button, "is-active", button.getAttribute("data-stat-period") === period);
    });

    if (period === "year") {
      var year = normalizeYearValue(els.overviewStatYear.value) || String(new Date().getFullYear());
      entries = getLedgerItemsForYearSelection(year);
      hint = formatYearSelection(year);
      balanceLabel = "年度结余";
      configureOverviewStatTrigger("overviewStatYear", "year", "选择统计年份", hint);
    } else if (period === "month") {
      var month = normalizeMonthValue(els.overviewStatMonth.value) || toMonthInputValue(new Date());
      entries = getLedgerItemsForMonth(month);
      hint = formatMonth(month);
      balanceLabel = "月度结余";
      configureOverviewStatTrigger("overviewStatMonth", "month", "选择统计月份", hint);
    } else {
      var date = normalizeDateValue(els.overviewStatDay.value) || toDateInputValue(new Date());
      entries = getLedgerItemsForDate(date);
      hint = formatFullDisplayDate(date);
      balanceLabel = "当日结余";
      configureOverviewStatTrigger("overviewStatDay", "date", "选择统计日期", hint);
    }

    var summary = summarize(entries);
    els.overviewBalanceLabel.textContent = balanceLabel;
    els.yearIncome.textContent = formatMoney(summary.income);
    els.yearExpense.textContent = formatMoney(summary.expense);
    els.yearBalance.textContent = formatMoney(summary.balance);
  }

  function renderOverviewCharts() {
    var day = normalizeDateValue(els.overviewPieDay.value) || toDateInputValue(new Date());
    var month = normalizeMonthValue(els.overviewPieMonth.value) || toMonthInputValue(new Date());
    var year = normalizeYearValue(els.overviewPieYear.value) || String(new Date().getFullYear());

    els.comparePieHint.textContent = "日 / 月 / 年";
    els.todayPieHint.textContent = formatFullDisplayDate(day);
    els.monthPieHint.textContent = formatMonth(month);
    els.yearPieHint.textContent = formatYearSelection(year);
    renderComparePie(els.todayComparePie, getLedgerItemsForDate(day));
    renderComparePie(els.monthComparePie, getLedgerItemsForMonth(month));
    renderComparePie(els.yearComparePie, getLedgerItemsForYearSelection(year));
    renderYearMonthBars(year);
  }

  function renderFormDay() {
    var date = els.dateInput.value || state.selectedDay;
    var entries = getLedgerItemsForDate(date);
    els.formDayHint.textContent = formatDisplayDate(date) + " · " + entries.length + " 项";
    renderEntries(els.formDayEntries, entries);
  }

  function renderDay() {
    var date = state.selectedDay;
    var entries = getLedgerItemsForDate(date);
    var summary = summarize(entries);

    els.dayIncome.textContent = formatMoney(summary.income);
    els.dayExpense.textContent = formatMoney(summary.expense);
    els.dayBalance.textContent = formatMoney(summary.balance);
    els.dayCategoryHint.textContent = formatDisplayDate(date) + " · " + entries.length + " 项";
    els.dayEntryCount.textContent = entries.length + " 项";

    renderCategoryBreakdown(els.dayIncomeCategories, entries, "income");
    renderCategoryBreakdown(els.dayExpenseCategories, entries, "expense");
    renderEntries(els.dayEntries, entries);
  }

  function renderMonth() {
    var month = state.selectedMonth;
    var entries = getLedgerItemsForMonth(month);
    var summary = summarize(entries);

    els.selectedMonthIncome.textContent = formatMoney(summary.income);
    els.selectedMonthExpense.textContent = formatMoney(summary.expense);
    els.selectedMonthBalance.textContent = formatMoney(summary.balance);
    els.monthEntryCount.textContent = entries.length + " 项";
    els.monthCategoryHint.textContent = formatMonth(month) + " · " + entries.length + " 项";

    renderDailySummary(month, entries);
    renderCategoryBreakdown(els.monthIncomeCategories, entries, "income");
    renderCategoryBreakdown(els.monthExpenseCategories, entries, "expense");
    renderEntries(els.monthEntries, entries);
  }

  function renderSavings() {
    var records = getSortedSavings(state.savings);
    els.savingsCount.textContent = records.length + " 条";

    if (!records.length) {
      els.latestSavingsAmount.textContent = formatMoney(0);
      els.latestSavingsMeta.textContent = "尚未记录";
      renderEmpty(els.savingsHistory);
      return;
    }

    var latest = records[0];
    els.latestSavingsAmount.textContent = formatMoney(latest.amount);
    els.latestSavingsMeta.textContent = formatFullDisplayDate(latest.date) + (latest.note ? " · " + latest.note : "");

    var html = "";
    for (var i = 0; i < records.length; i += 1) {
      var record = records[i];
      html +=
        '<article class="entry-item savings-item">' +
          '<div class="entry-main">' +
            '<div class="entry-title"><b>' + formatFullDisplayDate(record.date) + "</b></div>" +
            '<div class="entry-meta">' + (record.note ? escapeHtml(record.note) : "无备注") + "</div>" +
          "</div>" +
          '<div class="entry-actions">' +
            '<div class="entry-amount savings-amount">' + formatMoney(record.amount) + "</div>" +
            '<button class="delete-button" type="button" data-delete-savings-id="' + escapeHtml(record.id) + '" aria-label="删除存款记录">删</button>' +
          "</div>" +
        "</article>";
    }
    els.savingsHistory.innerHTML = html;
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
      var source = sourceLabel(entry.scope);
      var deleteAttr = entry.scope === "entry"
        ? 'data-delete-id="' + escapeHtml(entry.id) + '"'
        : 'data-total-kind="' + entry.scope + '" data-delete-total-id="' + escapeHtml(entry.id) + '"';
      html +=
        '<article class="entry-item">' +
          '<div class="entry-main">' +
            '<div class="entry-title">' +
              '<span class="badge ' + type + '">' + typeLabel(type) + "</span>" +
              "<b>" + escapeHtml(entry.category) + "</b>" +
            "</div>" +
            '<div class="entry-meta">' + source + " · " + itemDisplayDate(entry) + note + "</div>" +
          "</div>" +
          '<div class="entry-actions">' +
            '<div class="entry-amount ' + type + '">' + signedAmount + "</div>" +
            '<button class="delete-button" type="button" ' + deleteAttr + ' aria-label="删除记录">删</button>' +
          "</div>" +
        "</article>";
    }
    container.innerHTML = html;
  }

  function renderDailySummary(month, entries) {
    var grouped = {};
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      if (entry.scope === "monthly") continue;
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
          '<button type="button" data-open-day="' + row.date + '">' + row.count + " 项</button>" +
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

  function renderComparePie(container, entries) {
    var incomeRows = getCategoryRows(entries, "income");
    var expenseRows = getCategoryRows(entries, "expense");
    if (!incomeRows.length && !expenseRows.length) {
      renderEmpty(container);
      return;
    }

    var incomeTotal = sumCategoryRows(incomeRows);
    var expenseTotal = sumCategoryRows(expenseRows);
    var incomeColors = ["#cf3e48", "#e06a73", "#a9323c", "#ef9aa1", "#7b2d4f", "#c78aa4"];
    var expenseColors = ["#267a63", "#4f9a82", "#1b5f4d", "#86b9a8", "#7b2d4f", "#b6a0ae"];

    container.innerHTML =
      '<div class="pie-compare-content">' +
        buildComparePieSvg(incomeRows, incomeTotal, expenseRows, expenseTotal, incomeColors, expenseColors) +
        '<div class="pie-legend-groups">' +
          buildPieLegend("收入", incomeRows, incomeTotal, incomeColors) +
          buildPieLegend("支出", expenseRows, expenseTotal, expenseColors) +
        "</div>" +
      "</div>";
  }

  function renderPieBreakdown(container, entries, kind) {
    var rows = getCategoryRows(entries, kind);
    if (!rows.length) {
      renderEmpty(container);
      return;
    }

    var total = 0;
    for (var i = 0; i < rows.length; i += 1) {
      total = roundMoney(total + rows[i].amount);
    }

    var colors = kind === "income"
      ? ["#cf3e48", "#e06a73", "#a9323c", "#ef9aa1", "#7b2d4f", "#c78aa4"]
      : ["#267a63", "#4f9a82", "#1b5f4d", "#86b9a8", "#7b2d4f", "#b6a0ae"];

    var svg = buildPieSvg(rows, total, colors, kind);
    var legend = "";
    for (var j = 0; j < rows.length; j += 1) {
      legend +=
        '<div class="pie-legend-row">' +
          '<i class="pie-dot" style="--dot: ' + colors[j % colors.length] + '"></i>' +
          "<b>" + escapeHtml(rows[j].category) + "</b>" +
          "<span>" + formatMoney(rows[j].amount) + "</span>" +
        "</div>";
    }

    container.innerHTML =
      '<div class="pie-content">' +
        svg +
        '<div class="pie-legend">' + legend + "</div>" +
      "</div>";
  }

  function buildComparePieSvg(incomeRows, incomeTotal, expenseRows, expenseTotal, incomeColors, expenseColors) {
    return (
      '<svg class="pie-compare-chart" viewBox="0 0 320 170" role="img" aria-label="收入支出分类对比">' +
        buildPieGroup(incomeRows, incomeTotal, incomeColors, "收入", 82, 78) +
        buildPieGroup(expenseRows, expenseTotal, expenseColors, "支出", 238, 78) +
        '<text class="pie-caption-text" x="82" y="158" text-anchor="middle">收入分类</text>' +
        '<text class="pie-caption-text" x="238" y="158" text-anchor="middle">支出分类</text>' +
      "</svg>"
    );
  }

  function buildPieGroup(rows, total, colors, label, cx, cy) {
    var radius = 62;
    var innerRadius = 39;
    var paths = "";
    var startAngle = -90;
    var totalText = formatCompactMoney(total);

    if (!rows.length || total <= 0) {
      paths =
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="var(--surface)" stroke="var(--line)" stroke-width="2"></circle>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + innerRadius + '" fill="var(--surface-strong)"></circle>';
    } else if (rows.length === 1) {
      paths = '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="' + colors[0] + '"></circle>';
    } else {
      for (var i = 0; i < rows.length; i += 1) {
        var sweep = (rows[i].amount / total) * 360;
        var endAngle = startAngle + sweep;
        paths += describePieSlice(cx, cy, radius, startAngle, endAngle, colors[i % colors.length]);
        startAngle = endAngle;
      }
    }

    return (
      paths +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + innerRadius + '" fill="var(--surface)"></circle>' +
      '<text class="pie-label-text" x="' + cx + '" y="' + (cy - 5) + '" text-anchor="middle">' + label + '</text>' +
      '<text class="pie-total-text" x="' + cx + '" y="' + (cy + 12) + '" text-anchor="middle"' + fitSvgAmountText(totalText) + '>' + totalText + '</text>'
    );
  }

  function buildPieLegend(title, rows, total, colors) {
    var html = '<div class="pie-legend-group"><div class="pie-legend-title">' + title + "</div>";
    if (!rows.length) {
      html += '<div class="empty-state">暂无记录</div></div>';
      return html;
    }

    for (var i = 0; i < rows.length; i += 1) {
      html +=
        '<div class="pie-legend-row">' +
          '<i class="pie-dot" style="--dot: ' + colors[i % colors.length] + '"></i>' +
          "<b>" + escapeHtml(rows[i].category) + "</b>" +
          "<span>" + formatMoney(rows[i].amount) + "</span>" +
        "</div>";
    }
    html += "</div>";
    return html;
  }

  function getCategoryRows(entries, kind) {
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
    return rows;
  }

  function sumCategoryRows(rows) {
    var total = 0;
    for (var i = 0; i < rows.length; i += 1) {
      total = roundMoney(total + rows[i].amount);
    }
    return total;
  }

  function buildPieSvg(rows, total, colors, kind) {
    var cx = 60;
    var cy = 60;
    var radius = 48;
    var startAngle = -90;
    var paths = "";

    if (rows.length === 1) {
      paths =
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="' + colors[0] + '"></circle>';
    } else {
      for (var i = 0; i < rows.length; i += 1) {
        var sweep = total > 0 ? (rows[i].amount / total) * 360 : 0;
        var endAngle = startAngle + sweep;
        paths += describePieSlice(cx, cy, radius, startAngle, endAngle, colors[i % colors.length]);
        startAngle = endAngle;
      }
    }

    return (
      '<svg class="pie-chart" viewBox="0 0 120 120" role="img" aria-label="' + typeLabel(kind) + '分类占比">' +
        paths +
        '<circle cx="60" cy="60" r="24" fill="var(--surface)"></circle>' +
        '<text x="60" y="57" text-anchor="middle">' + typeLabel(kind) + '</text>' +
        '<text x="60" y="71" text-anchor="middle">' + formatCompactMoney(total) + '</text>' +
      "</svg>"
    );
  }

  function describePieSlice(cx, cy, radius, startAngle, endAngle, color) {
    var start = polarToCartesian(cx, cy, radius, endAngle);
    var end = polarToCartesian(cx, cy, radius, startAngle);
    var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    var d = [
      "M", cx, cy,
      "L", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ");

    return '<path d="' + d + '" fill="' + color + '"></path>';
  }

  function polarToCartesian(cx, cy, radius, angleInDegrees) {
    var angleInRadians = (angleInDegrees * Math.PI) / 180;
    return {
      x: roundChartNumber(cx + radius * Math.cos(angleInRadians)),
      y: roundChartNumber(cy + radius * Math.sin(angleInRadians))
    };
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
    var yearEntries = getLedgerItemsForYearSelection(year);
    var rows = [];
    for (var month = 1; month <= 12; month += 1) {
      var key = year + "-" + pad2(month);
      var entries = [];
      for (var entryIndex = 0; entryIndex < yearEntries.length; entryIndex += 1) {
        if (yearEntries[entryIndex].month === key) entries.push(yearEntries[entryIndex]);
      }
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

  function getAllLedgerItems() {
    var items = [];
    for (var i = 0; i < state.entries.length; i += 1) {
      items.push(entryToLedgerItem(state.entries[i]));
    }
    appendDailyTotalItems(items, state.dailyTotals);
    appendMonthlyTotalItems(items, state.monthlyTotals);
    return items;
  }

  function getLedgerItemsForDate(date) {
    var items = [];
    for (var i = 0; i < state.entries.length; i += 1) {
      if (state.entries[i].date === date) items.push(entryToLedgerItem(state.entries[i]));
    }
    for (var j = 0; j < state.dailyTotals.length; j += 1) {
      if (state.dailyTotals[j].date === date) appendDailyTotalItems(items, [state.dailyTotals[j]]);
    }
    return getSortedLedgerItems(items);
  }

  function getLedgerItemsForMonth(month) {
    var items = [];
    for (var i = 0; i < state.entries.length; i += 1) {
      if (state.entries[i].date.slice(0, 7) === month) items.push(entryToLedgerItem(state.entries[i]));
    }
    for (var j = 0; j < state.dailyTotals.length; j += 1) {
      if (state.dailyTotals[j].date.slice(0, 7) === month) appendDailyTotalItems(items, [state.dailyTotals[j]]);
    }
    for (var k = 0; k < state.monthlyTotals.length; k += 1) {
      if (state.monthlyTotals[k].month === month) appendMonthlyTotalItems(items, [state.monthlyTotals[k]]);
    }
    return getSortedLedgerItems(items);
  }

  function getLedgerItemsForYearThroughDate(year, today) {
    var todayMonth = today.slice(0, 7);
    var items = [];
    for (var i = 0; i < state.entries.length; i += 1) {
      if (state.entries[i].date.slice(0, 4) === year && state.entries[i].date <= today) {
        items.push(entryToLedgerItem(state.entries[i]));
      }
    }
    for (var j = 0; j < state.dailyTotals.length; j += 1) {
      if (state.dailyTotals[j].date.slice(0, 4) === year && state.dailyTotals[j].date <= today) {
        appendDailyTotalItems(items, [state.dailyTotals[j]]);
      }
    }
    for (var k = 0; k < state.monthlyTotals.length; k += 1) {
      if (state.monthlyTotals[k].month.slice(0, 4) === year && state.monthlyTotals[k].month <= todayMonth) {
        appendMonthlyTotalItems(items, [state.monthlyTotals[k]]);
      }
    }
    return getSortedLedgerItems(items);
  }

  function getLedgerItemsForYear(year) {
    var items = [];
    for (var i = 0; i < state.entries.length; i += 1) {
      if (state.entries[i].date.slice(0, 4) === year) items.push(entryToLedgerItem(state.entries[i]));
    }
    for (var j = 0; j < state.dailyTotals.length; j += 1) {
      if (state.dailyTotals[j].date.slice(0, 4) === year) appendDailyTotalItems(items, [state.dailyTotals[j]]);
    }
    for (var k = 0; k < state.monthlyTotals.length; k += 1) {
      if (state.monthlyTotals[k].month.slice(0, 4) === year) appendMonthlyTotalItems(items, [state.monthlyTotals[k]]);
    }
    return getSortedLedgerItems(items);
  }

  function getLedgerItemsForYearSelection(year) {
    var today = toDateInputValue(new Date());
    return year === today.slice(0, 4)
      ? getLedgerItemsForYearThroughDate(year, today)
      : getLedgerItemsForYear(year);
  }

  function entryToLedgerItem(entry) {
    return {
      id: entry.id,
      scope: "entry",
      type: entry.type,
      amount: entry.amount,
      date: entry.date,
      month: entry.date.slice(0, 7),
      category: entry.category,
      note: entry.note,
      createdAt: entry.createdAt
    };
  }

  function appendDailyTotalItems(items, totals) {
    for (var i = 0; i < totals.length; i += 1) {
      var total = totals[i];
      if (total.income > 0) {
        items.push({
          id: total.id,
          scope: "daily",
          type: "income",
          amount: total.income,
          date: total.date,
          month: total.date.slice(0, 7),
          category: "每天总账",
          note: total.note,
          createdAt: total.createdAt
        });
      }
      if (total.expense > 0) {
        items.push({
          id: total.id,
          scope: "daily",
          type: "expense",
          amount: total.expense,
          date: total.date,
          month: total.date.slice(0, 7),
          category: "每天总账",
          note: total.note,
          createdAt: total.createdAt
        });
      }
    }
  }

  function appendMonthlyTotalItems(items, totals) {
    for (var i = 0; i < totals.length; i += 1) {
      var total = totals[i];
      if (total.income > 0) {
        items.push({
          id: total.id,
          scope: "monthly",
          type: "income",
          amount: total.income,
          date: total.month + "-01",
          month: total.month,
          category: "每月总账",
          note: total.note,
          createdAt: total.createdAt
        });
      }
      if (total.expense > 0) {
        items.push({
          id: total.id,
          scope: "monthly",
          type: "expense",
          amount: total.expense,
          date: total.month + "-01",
          month: total.month,
          category: "每月总账",
          note: total.note,
          createdAt: total.createdAt
        });
      }
    }
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

  function normalizeTotals(values, kind) {
    var totals = [];
    if (!Array.isArray(values)) return totals;
    for (var i = 0; i < values.length; i += 1) {
      var total = normalizeTotal(values[i], kind);
      if (total) totals.push(total);
    }
    return totals;
  }

  function normalizeTotal(total, kind) {
    if (!total || typeof total !== "object") return null;

    var income = roundMoney(Math.max(0, Number(total.income) || 0));
    var expense = roundMoney(Math.max(0, Number(total.expense) || 0));
    if (income <= 0 && expense <= 0) return null;

    if (kind === "monthly") {
      var month = normalizeMonthValue(String(total.month || ""));
      if (!month) return null;
      return {
        id: String(total.id || createId()),
        month: month,
        income: income,
        expense: expense,
        note: String(total.note || "").replace(/^\s+|\s+$/g, "").slice(0, 80),
        createdAt: String(total.createdAt || new Date().toISOString())
      };
    }

    var date = String(total.date || "");
    if (!isDateInputValue(date)) return null;
    return {
      id: String(total.id || createId()),
      date: date,
      income: income,
      expense: expense,
      note: String(total.note || "").replace(/^\s+|\s+$/g, "").slice(0, 80),
      createdAt: String(total.createdAt || new Date().toISOString())
    };
  }

  function normalizeSavingsList(values) {
    var records = [];
    if (!Array.isArray(values)) return records;
    for (var i = 0; i < values.length; i += 1) {
      var record = normalizeSavings(values[i]);
      if (record) records.push(record);
    }
    return records;
  }

  function normalizeSavings(record) {
    if (!record || typeof record !== "object") return null;
    var date = normalizeDateValue(String(record.date || ""));
    var amount = Number(record.amount);
    if (!date || !isFinite(amount) || amount < 0) return null;
    return {
      id: String(record.id || createId()),
      date: date,
      amount: roundMoney(amount),
      note: String(record.note || "").replace(/^\s+|\s+$/g, "").slice(0, 80),
      createdAt: String(record.createdAt || new Date().toISOString())
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

  function mergeTotals(current, imported) {
    var byId = {};
    var result = [];

    for (var i = 0; i < current.length; i += 1) {
      byId[current[i].id] = result.length;
      result.push(current[i]);
    }

    for (var j = 0; j < imported.length; j += 1) {
      var total = imported[j];
      if (typeof byId[total.id] === "number") {
        result[byId[total.id]] = total;
      } else {
        byId[total.id] = result.length;
        result.push(total);
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

  function getSortedLedgerItems(items) {
    return items.slice().sort(function (a, b) {
      var dateCompare = itemSortDate(b).localeCompare(itemSortDate(a));
      if (dateCompare !== 0) return dateCompare;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function getSortedDailyTotals(totals) {
    return totals.slice().sort(function (a, b) {
      var dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function getSortedMonthlyTotals(totals) {
    return totals.slice().sort(function (a, b) {
      var monthCompare = b.month.localeCompare(a.month);
      if (monthCompare !== 0) return monthCompare;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function getSortedSavings(records) {
    return records.slice().sort(function (a, b) {
      var dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function itemSortDate(item) {
    if (item.scope === "monthly") return item.month + "-99";
    return item.date;
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

  function sourceLabel(scope) {
    if (scope === "daily") return "每天总账";
    if (scope === "monthly") return "每月总账";
    return "单笔记录";
  }

  function itemDisplayDate(item) {
    if (item.scope === "monthly") return formatMonth(item.month);
    return formatDisplayDate(item.date);
  }

  function getLedgerRecordCount() {
    return state.entries.length + state.dailyTotals.length + state.monthlyTotals.length;
  }

  function formatMoney(value) {
    if (currency) return currency.format(value || 0);
    return "¥" + formatNumber(value || 0);
  }

  function formatNumber(value) {
    if (numberFormatter) return numberFormatter.format(value || 0);
    return Number(value || 0).toFixed(2);
  }

  function formatCompactMoney(value) {
    value = Number(value || 0);
    return "¥" + value.toFixed(2);
  }

  function fitSvgAmountText(text) {
    return String(text).length > 9 ? ' textLength="78" lengthAdjust="spacingAndGlyphs"' : "";
  }

  function formatMonth(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return "--";
    var parts = month.split("-");
    return parts[0] + "年" + Number(parts[1]) + "月";
  }

  function formatYearSelection(year) {
    var currentYear = String(new Date().getFullYear());
    return year === currentYear ? year + "年截止今日" : year + "年";
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

  function formatFullDisplayDate(dateValue) {
    if (!isDateInputValue(dateValue)) return "--";
    return dateValue.slice(0, 4) + "年" + formatDisplayDate(dateValue);
  }

  function toDateInputValue(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function toMonthInputValue(date) {
    return toDateInputValue(date).slice(0, 7);
  }

  function normalizeMonthValue(value) {
    value = String(value || "").replace(/^\s+|\s+$/g, "");
    if (/^\d{6}$/.test(value)) {
      value = value.slice(0, 4) + "-" + value.slice(4, 6);
    }
    value = value.replace(/[./年]/g, "-").replace(/月/g, "");
    var parts = value.split("-");
    if (parts.length === 2 && /^\d{4}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
      var monthNumber = Number(parts[1]);
      if (monthNumber >= 1 && monthNumber <= 12) {
        return parts[0] + "-" + pad2(monthNumber);
      }
    }
    return "";
  }

  function normalizeYearValue(value) {
    value = String(value || "").replace(/^\s+|\s+$/g, "").replace(/年/g, "");
    return /^\d{4}$/.test(value) ? value : "";
  }

  function normalizeDateValue(value) {
    value = String(value || "").replace(/^\s+|\s+$/g, "");
    if (/^\d{8}$/.test(value)) {
      value = value.slice(0, 4) + "-" + value.slice(4, 6) + "-" + value.slice(6, 8);
    }
    value = value.replace(/[./年]/g, "-").replace(/月/g, "-").replace(/日/g, "");
    var parts = value.split("-");
    if (parts.length === 3 && /^\d{4}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1]) && /^\d{1,2}$/.test(parts[2])) {
      var normalized = parts[0] + "-" + pad2(Number(parts[1])) + "-" + pad2(Number(parts[2]));
      return isDateInputValue(normalized) ? normalized : "";
    }
    return isDateInputValue(value) ? value : "";
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

  function roundChartNumber(value) {
    return Math.round(value * 1000) / 1000;
  }

  function readMoneyInput(input) {
    var value = Number(input.value);
    if (!isFinite(value) || value <= 0) return 0;
    return roundMoney(value);
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
