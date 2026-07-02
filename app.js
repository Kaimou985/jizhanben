(() => {
  const STORE_KEY = "ledger.entries.v1";
  const CATEGORY_KEY = "ledger.categories.v1";

  const defaultCategories = {
    income: ["工资", "奖金", "副业", "投资", "退款", "其他收入"],
    expense: ["餐饮", "交通", "购物", "居住", "医疗", "学习", "娱乐", "人情", "其他支出"],
  };

  const state = {
    entries: [],
    categories: structuredCloneSafe(defaultCategories),
    entryType: "expense",
    selectedDay: toDateInputValue(new Date()),
    selectedMonth: toMonthInputValue(new Date()),
  };

  const currency = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const numberFormatter = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", {
    weekday: "short",
  });

  const els = {};

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
    const ids = [
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
      "clearDataBtn",
    ];

    ids.forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function wireEvents() {
    document.querySelectorAll("[data-target]").forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.target));
    });

    document.querySelectorAll("[data-entry-type]").forEach((button) => {
      button.addEventListener("click", () => setEntryType(button.dataset.entryType));
    });

    els.quickAddBtn.addEventListener("click", () => {
      setView("add");
      setTimeout(() => els.amountInput.focus(), 0);
    });

    els.seedSampleBtn.addEventListener("click", addSampleData);
    els.entryForm.addEventListener("submit", saveEntry);

    els.dateInput.addEventListener("change", () => {
      renderFormDay();
    });

    els.dayPicker.addEventListener("change", () => {
      state.selectedDay = els.dayPicker.value || toDateInputValue(new Date());
      renderDay();
    });

    els.monthPicker.addEventListener("change", () => {
      state.selectedMonth = els.monthPicker.value || toMonthInputValue(new Date());
      renderMonth();
    });

    els.addIncomeCategory.addEventListener("click", () => addCategory("income"));
    els.addExpenseCategory.addEventListener("click", () => addCategory("expense"));
    els.exportJsonBtn.addEventListener("click", exportJson);
    els.exportCsvBtn.addEventListener("click", exportCsv);
    els.importJsonInput.addEventListener("change", importJson);
    els.clearDataBtn.addEventListener("click", clearData);

    document.body.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-delete-id]");
      if (deleteButton) {
        deleteEntry(deleteButton.dataset.deleteId);
        return;
      }

      const dayButton = event.target.closest("[data-open-day]");
      if (dayButton) {
        state.selectedDay = dayButton.dataset.openDay;
        els.dayPicker.value = state.selectedDay;
        setView("day");
        renderDay();
        return;
      }

      const removeCategoryButton = event.target.closest("[data-remove-category]");
      if (removeCategoryButton) {
        removeCategory(removeCategoryButton.dataset.kind, removeCategoryButton.dataset.removeCategory);
      }
    });
  }

  function loadState() {
    const storedEntries = parseJson(localStorage.getItem(STORE_KEY), []);
    state.entries = storedEntries.map(normalizeEntry).filter(Boolean);

    const storedCategories = parseJson(localStorage.getItem(CATEGORY_KEY), null);
    state.categories = mergeCategories(storedCategories);
  }

  function persistEntries() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.entries));
  }

  function persistCategories() {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(state.categories));
  }

  function setView(target) {
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.toggle("is-active", view.dataset.view === target);
    });

    document.querySelectorAll("[data-target]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.target === target);
    });

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function setEntryType(type) {
    state.entryType = type === "income" ? "income" : "expense";
    document.querySelectorAll("[data-entry-type]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.entryType === state.entryType);
    });
    renderCategoryOptions();
  }

  function saveEntry(event) {
    event.preventDefault();

    const amount = Number(els.amountInput.value);
    const date = els.dateInput.value;
    const category = els.categoryInput.value;
    const note = els.noteInput.value.trim();

    if (!date || !category || !Number.isFinite(amount) || amount <= 0) {
      alert("请填写有效的日期、分类和金额。");
      return;
    }

    const entry = {
      id: createId(),
      type: state.entryType,
      amount: roundMoney(amount),
      date,
      category,
      note,
      createdAt: new Date().toISOString(),
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
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;

    const label = `${entry.date} ${typeLabel(entry.type)} ${entry.category} ${formatMoney(entry.amount)}`;
    if (!confirm(`删除这笔记录？\n${label}`)) return;

    state.entries = state.entries.filter((item) => item.id !== id);
    persistEntries();
    renderAll();
  }

  function addSampleData() {
    if (state.entries.length > 0 && !confirm("示例数据会追加到当前账本，继续添加？")) {
      return;
    }

    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const samples = [
      { offset: 0, type: "expense", amount: 28, category: "餐饮", note: "午餐" },
      { offset: 0, type: "expense", amount: 12, category: "交通", note: "地铁" },
      { offset: 1, type: "income", amount: 8200, category: "工资", note: "本月工资" },
      { offset: 2, type: "expense", amount: 230, category: "购物", note: "日用品" },
      { offset: 4, type: "expense", amount: 1680, category: "居住", note: "房租" },
      { offset: 6, type: "income", amount: 600, category: "副业", note: "项目收入" },
      { offset: 8, type: "expense", amount: 86, category: "娱乐", note: "电影" },
      { offset: 12, type: "expense", amount: 120, category: "医疗", note: "药品" },
    ];

    const newEntries = samples.map((sample) => {
      const date = new Date(y, m, Math.max(1, today.getDate() - sample.offset));
      return {
        id: createId(),
        type: sample.type,
        amount: sample.amount,
        date: toDateInputValue(date),
        category: sample.category,
        note: sample.note,
        createdAt: new Date().toISOString(),
      };
    });

    state.entries.push(...newEntries);
    persistEntries();
    renderAll();
  }

  function addCategory(kind) {
    const input = kind === "income" ? els.newIncomeCategory : els.newExpenseCategory;
    const value = input.value.trim();
    if (!value) return;

    if (state.categories[kind].includes(value)) {
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
    if (!state.categories[kind] || !state.categories[kind].includes(category)) return;

    const isUsed = state.entries.some((entry) => entry.type === kind && entry.category === category);
    const message = isUsed
      ? `分类“${category}”已有记录使用。删除分类不会删除历史记录，但以后新增时不再显示。继续？`
      : `删除分类“${category}”？`;

    if (!confirm(message)) return;

    state.categories[kind] = state.categories[kind].filter((item) => item !== category);
    if (state.categories[kind].length === 0) {
      state.categories[kind] = [...defaultCategories[kind]];
    }
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
    const payload = {
      app: "local-ledger",
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: state.categories,
      entries: getSortedEntries(state.entries),
    };

    downloadFile(
      `本地账本备份-${toDateInputValue(new Date())}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
  }

  function exportCsv() {
    const header = ["日期", "类型", "金额", "分类", "备注", "创建时间"];
    const rows = getSortedEntries(state.entries).map((entry) => [
      entry.date,
      typeLabel(entry.type),
      numberFormatter.format(entry.amount),
      entry.category,
      entry.note,
      entry.createdAt,
    ]);

    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    downloadFile(`本地账本明细-${toDateInputValue(new Date())}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  }

  function importJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const data = parseJson(String(reader.result), null);
      if (!data || !Array.isArray(data.entries)) {
        alert("导入失败：不是有效的账本 JSON。");
        event.target.value = "";
        return;
      }

      const importedEntries = data.entries.map(normalizeEntry).filter(Boolean);
      const importedCategories = mergeCategories(data.categories);
      const shouldReplace = confirm("选择“确定”覆盖当前数据；选择“取消”则追加导入记录。");

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
    const today = toDateInputValue(new Date());
    const thisMonth = today.slice(0, 7);
    const thisYear = today.slice(0, 4);

    const todayEntries = state.entries.filter((entry) => entry.date === today);
    const monthEntries = state.entries.filter((entry) => entry.date.slice(0, 7) === thisMonth);
    const yearEntries = state.entries.filter((entry) => entry.date.slice(0, 4) === thisYear && entry.date <= today);

    const todaySummary = summarize(todayEntries);
    const monthSummary = summarize(monthEntries);
    const yearSummary = summarize(yearEntries);

    els.todayText.textContent = `${formatDisplayDate(today)}，今年统计截止今日`;
    els.todayIncome.textContent = formatMoney(todaySummary.income);
    els.todayExpense.textContent = formatMoney(todaySummary.expense);
    els.monthIncome.textContent = formatMoney(monthSummary.income);
    els.monthExpense.textContent = formatMoney(monthSummary.expense);
    els.yearIncome.textContent = formatMoney(yearSummary.income);
    els.yearExpense.textContent = formatMoney(yearSummary.expense);
    els.yearBalance.textContent = formatMoney(yearSummary.balance);
    els.entryCount.textContent = `${state.entries.length} 笔`;

    renderEntries(els.recentEntries, getSortedEntries(state.entries).slice(0, 8));
    renderYearMonthBars(thisYear);
  }

  function renderFormDay() {
    const date = els.dateInput.value || state.selectedDay;
    const entries = getSortedEntries(state.entries.filter((entry) => entry.date === date));
    els.formDayHint.textContent = `${formatDisplayDate(date)} · ${entries.length} 笔`;
    renderEntries(els.formDayEntries, entries);
  }

  function renderDay() {
    const date = state.selectedDay;
    const entries = getSortedEntries(state.entries.filter((entry) => entry.date === date));
    const summary = summarize(entries);

    els.dayIncome.textContent = formatMoney(summary.income);
    els.dayExpense.textContent = formatMoney(summary.expense);
    els.dayBalance.textContent = formatMoney(summary.balance);
    els.dayCategoryHint.textContent = `${formatDisplayDate(date)} · ${entries.length} 笔`;
    els.dayEntryCount.textContent = `${entries.length} 笔`;

    renderCategoryBreakdown(els.dayIncomeCategories, entries, "income");
    renderCategoryBreakdown(els.dayExpenseCategories, entries, "expense");
    renderEntries(els.dayEntries, entries);
  }

  function renderMonth() {
    const month = state.selectedMonth;
    const entries = getSortedEntries(state.entries.filter((entry) => entry.date.slice(0, 7) === month));
    const summary = summarize(entries);

    els.selectedMonthIncome.textContent = formatMoney(summary.income);
    els.selectedMonthExpense.textContent = formatMoney(summary.expense);
    els.selectedMonthBalance.textContent = formatMoney(summary.balance);
    els.monthEntryCount.textContent = `${entries.length} 笔`;
    els.monthCategoryHint.textContent = `${formatMonth(month)} · ${entries.length} 笔`;

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
    const options = state.categories[state.entryType]
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join("");
    els.categoryInput.innerHTML = options;
  }

  function renderEntries(container, entries) {
    if (!entries.length) {
      renderEmpty(container);
      return;
    }

    container.innerHTML = entries
      .map((entry) => {
        const type = entry.type === "income" ? "income" : "expense";
        const signedAmount = type === "income" ? formatMoney(entry.amount) : `-${formatMoney(entry.amount)}`;
        const note = entry.note ? ` · ${escapeHtml(entry.note)}` : "";
        return `
          <article class="entry-item">
            <div class="entry-main">
              <div class="entry-title">
                <span class="badge ${type}">${typeLabel(type)}</span>
                <b>${escapeHtml(entry.category)}</b>
              </div>
              <div class="entry-meta">${formatDisplayDate(entry.date)}${note}</div>
            </div>
            <div class="entry-actions">
              <div class="entry-amount ${type}">${signedAmount}</div>
              <button class="delete-button" type="button" data-delete-id="${escapeHtml(entry.id)}" aria-label="删除记录">删</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderDailySummary(month, entries) {
    const grouped = new Map();
    entries.forEach((entry) => {
      if (!grouped.has(entry.date)) grouped.set(entry.date, []);
      grouped.get(entry.date).push(entry);
    });

    const rows = Array.from(grouped.entries())
      .map(([date, items]) => ({ date, ...summarize(items), count: items.length }))
      .sort((a, b) => b.date.localeCompare(a.date));

    els.dailySummaryHint.textContent = `${formatMonth(month)} · ${rows.length} 天有记录`;

    if (!rows.length) {
      renderEmpty(els.dailySummaryList);
      return;
    }

    els.dailySummaryList.innerHTML = rows
      .map(
        (row) => `
          <article class="daily-item">
            <div class="daily-main">
              <b>${formatDisplayDate(row.date)}</b>
              <div class="daily-meta">
                <span class="income-text">收入 ${formatMoney(row.income)}</span>
                <span class="expense-text">支出 ${formatMoney(row.expense)}</span>
                <span>结余 ${formatMoney(row.balance)}</span>
              </div>
            </div>
            <button type="button" data-open-day="${row.date}">${row.count} 笔</button>
          </article>
        `,
      )
      .join("");
  }

  function renderCategoryBreakdown(container, entries, kind) {
    const totals = new Map();
    entries
      .filter((entry) => entry.type === kind)
      .forEach((entry) => {
        totals.set(entry.category, roundMoney((totals.get(entry.category) || 0) + entry.amount));
      });

    const rows = Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    if (!rows.length) {
      renderEmpty(container);
      return;
    }

    const max = Math.max(...rows.map((row) => row.amount));
    container.innerHTML = rows
      .map((row) => {
        const percent = max > 0 ? Math.max(3, Math.round((row.amount / max) * 100)) : 0;
        return `
          <article class="category-row">
            <div class="category-top">
              <b>${escapeHtml(row.category)}</b>
              <span>${formatMoney(row.amount)}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill ${kind}" style="--width: ${percent}%"></div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderCategoryChips(container, kind) {
    container.innerHTML = state.categories[kind]
      .map(
        (category) => `
          <span class="chip">
            <span>${escapeHtml(category)}</span>
            <button type="button" data-kind="${kind}" data-remove-category="${escapeHtml(category)}" aria-label="删除${escapeHtml(category)}">×</button>
          </span>
        `,
      )
      .join("");
  }

  function renderYearMonthBars(year) {
    const rows = [];
    for (let month = 1; month <= 12; month += 1) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const entries = state.entries.filter((entry) => entry.date.slice(0, 7) === key);
      rows.push({ month, key, ...summarize(entries) });
    }

    const max = Math.max(1, ...rows.map((row) => Math.max(row.income, row.expense)));
    els.yearMonthHint.textContent = `${year} 年`;
    els.yearMonthBars.innerHTML = rows
      .map((row) => {
        const incomeWidth = Math.round((row.income / max) * 100);
        const expenseWidth = Math.round((row.expense / max) * 100);
        return `
          <div class="month-bar-row">
            <div class="month-bar-label">${row.month}月</div>
            <div class="month-bar-track" aria-label="${row.month}月收入支出">
              <div class="month-line"><span class="income" style="--width: ${incomeWidth}%"></span></div>
              <div class="month-line"><span class="expense" style="--width: ${expenseWidth}%"></span></div>
            </div>
            <div class="month-bar-total">${formatMoney(row.balance)}</div>
          </div>
        `;
      })
      .join("");
  }

  function renderEmpty(container) {
    container.innerHTML = document.getElementById("emptyTemplate").innerHTML;
  }

  function summarize(entries) {
    return entries.reduce(
      (acc, entry) => {
        if (entry.type === "income") {
          acc.income = roundMoney(acc.income + entry.amount);
        } else {
          acc.expense = roundMoney(acc.expense + entry.amount);
        }
        acc.balance = roundMoney(acc.income - acc.expense);
        return acc;
      },
      { income: 0, expense: 0, balance: 0 },
    );
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const amount = Number(entry.amount);
    const date = String(entry.date || "");
    const type = entry.type === "income" ? "income" : entry.type === "expense" ? "expense" : null;
    const category = String(entry.category || "").trim();

    if (!type || !isDateInputValue(date) || !Number.isFinite(amount) || amount <= 0 || !category) {
      return null;
    }

    return {
      id: String(entry.id || createId()),
      type,
      amount: roundMoney(amount),
      date,
      category,
      note: String(entry.note || "").trim().slice(0, 80),
      createdAt: String(entry.createdAt || new Date().toISOString()),
    };
  }

  function mergeEntries(current, imported) {
    const byId = new Map(current.map((entry) => [entry.id, entry]));
    imported.forEach((entry) => {
      byId.set(entry.id, entry);
    });
    return Array.from(byId.values());
  }

  function mergeCategories(source) {
    const result = structuredCloneSafe(defaultCategories);
    if (!source || typeof source !== "object") return result;

    ["income", "expense"].forEach((kind) => {
      if (Array.isArray(source[kind])) {
        const clean = source[kind]
          .map((item) => String(item || "").trim())
          .filter(Boolean);
        result[kind] = Array.from(new Set([...result[kind], ...clean]));
      }
    });

    return result;
  }

  function getSortedEntries(entries) {
    return [...entries].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        // Local file previews cannot register service workers. The app still works with local storage.
      });
    });
  }

  function createId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function typeLabel(type) {
    return type === "income" ? "收入" : "支出";
  }

  function formatMoney(value) {
    return currency.format(value || 0);
  }

  function formatMonth(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return "--";
    const [year, monthNumber] = month.split("-");
    return `${year}年${Number(monthNumber)}月`;
  }

  function formatDisplayDate(dateValue) {
    if (!isDateInputValue(dateValue)) return "--";
    const [year, month, day] = dateValue.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return `${month}月${day}日 ${weekdayFormatter.format(date)}`;
  }

  function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function toMonthInputValue(date) {
    return toDateInputValue(date).slice(0, 7);
  }

  function isDateInputValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function parseJson(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
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
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }
})();
