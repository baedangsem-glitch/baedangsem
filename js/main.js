import { SITE_CONFIG, MARKETS, TAX_RULES } from "./config.js";
import { calculateDividend, calculateForeignDividend, calculateBond } from "./calculator.js";

const formatKRW = (amount) => `${Math.round(amount).toLocaleString("ko-KR")}원`;

function formatForeign(amount, marketCode) {
  if (marketCode === "US") {
    return `$${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (marketCode === "JP") {
    return `¥${amount.toLocaleString("ja-JP", {
      maximumFractionDigits: 2,
    })}`;
  }
  return formatKRW(amount);
}

document.addEventListener("DOMContentLoaded", () => {
  // 사이트 공통 정보 바인딩
  document.querySelectorAll("[data-site-name]").forEach((el) => {
    el.textContent = SITE_CONFIG.siteName;
  });
  document.querySelectorAll("[data-contact-email]").forEach((el) => {
    el.textContent = SITE_CONFIG.contactEmail;
    if (el.tagName === "A") el.href = `mailto:${SITE_CONFIG.contactEmail}`;
  });

  const marketCode = document.body.dataset.market || "KR";

  // 채권 이자 계산기 전용 로직
  if (marketCode === "BOND") {
    const faceValueInput = document.getElementById("faceValue");
    const buyPriceInput = document.getElementById("buyPricePer10k");
    const couponRateInput = document.getElementById("couponRate");
    const monthsInput = document.getElementById("monthsToMaturity");
    const freqRadios = document.querySelectorAll('input[name="frequency"]');
    const taxCheckboxes = document.querySelectorAll('input[name="taxExemption"]');
    const customRateWrap = document.getElementById("customRateWrap");
    const customRateInput = document.getElementById("customTaxRate");
    const resetBtn = document.getElementById("resetBtn");

    const resTotalNetProfit = document.getElementById("resTotalNetProfit");
    const resAnnualizedYield = document.getElementById("resAnnualizedYield");
    const resActualInvest = document.getElementById("resActualInvest");
    const resPerPayoutInterest = document.getElementById("resPerPayoutInterest");
    const resAnnualAfterTax = document.getElementById("resAnnualAfterTax");
    const resTotalInterest = document.getElementById("resTotalInterest");
    const resCapitalGain = document.getElementById("resCapitalGain");
    const resTotalTax = document.getElementById("resTotalTax");
    const resAppliedBadge = document.getElementById("resAppliedBadge");
    const resAppliedDesc = document.getElementById("resAppliedDesc");
    const resCompTaxWarning = document.getElementById("resCompTaxWarning");

    function updateBondCalc() {
      const checkedFreq = document.querySelector('input[name="frequency"]:checked');
      const checkedTax = document.querySelector('input[name="taxExemption"]:checked');

      const result = calculateBond({
        faceValue: faceValueInput.value,
        buyPricePer10k: buyPriceInput.value,
        couponRate: couponRateInput.value,
        frequency: checkedFreq ? Number(checkedFreq.value) : 4,
        monthsToMaturity: monthsInput.value,
        taxRuleId: checkedTax ? checkedTax.value : TAX_RULES.STANDARD.id,
        customRate: customRateInput ? customRateInput.value : 0,
      });

      resTotalNetProfit.textContent = formatKRW(result.totalNetProfit);
      resAnnualizedYield.textContent = `연환산 세후 수익률 ${result.annualizedAfterTaxYield.toFixed(2)}%`;
      resActualInvest.textContent = formatKRW(result.actualInvestAmount);
      resPerPayoutInterest.textContent = formatKRW(result.perPayoutAfterTaxInterest);
      resAnnualAfterTax.textContent = formatKRW(result.annualAfterTaxInterest);
      resTotalInterest.textContent = formatKRW(result.totalAfterTaxInterest);

      const gainPrefix = result.capitalGain > 0 ? "+" : "";
      resCapitalGain.textContent = `${gainPrefix}${formatKRW(result.capitalGain)}`;
      resCapitalGain.classList.toggle("text-success", result.capitalGain > 0);
      resCapitalGain.classList.toggle("text-danger", result.capitalGain < 0);

      resTotalTax.textContent = `-${formatKRW(result.totalTax)}`;
      resAppliedBadge.textContent = result.appliedRuleLabel;
      resAppliedDesc.textContent = result.appliedRuleDesc;
      if (resCompTaxWarning) {
        resCompTaxWarning.classList.toggle("hidden", !result.isComprehensiveTaxTarget);
      }
    }

    taxCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        if (e.target.checked) {
          taxCheckboxes.forEach((other) => {
            if (other !== e.target) other.checked = false;
          });
        }
        const customCb = document.getElementById("tax_custom");
        if (customCb && customRateWrap) {
          customRateWrap.classList.toggle("hidden", !customCb.checked);
        }
        updateBondCalc();
      });
    });

    [faceValueInput, buyPriceInput, couponRateInput, monthsInput, customRateInput].forEach((input) => {
      if (input) input.addEventListener("input", updateBondCalc);
    });

    freqRadios.forEach((radio) => {
      radio.addEventListener("change", updateBondCalc);
    });

    resetBtn.addEventListener("click", () => {
      faceValueInput.value = "";
      buyPriceInput.value = "10000";
      couponRateInput.value = "";
      monthsInput.value = "12";
      document.getElementById("freq_4").checked = true;
      taxCheckboxes.forEach((cb) => (cb.checked = false));
      if (customRateInput) customRateInput.value = "";
      if (customRateWrap) customRateWrap.classList.add("hidden");
      updateBondCalc();
    });

    updateBondCalc();
    return;
  }

  const isForeign = marketCode === "US" || marketCode === "JP";
  const marketConfig = MARKETS[marketCode] || MARKETS.KR;

  const dpsInput = document.getElementById("dividendPerShare");
  const qtyInput = document.getElementById("quantity");
  const freqRadios = document.querySelectorAll('input[name="frequency"]');
  const taxCheckboxes = document.querySelectorAll('input[name="taxExemption"]');
  const customRateWrap = document.getElementById("customRateWrap");
  const customRateInput = document.getElementById("customTaxRate");
  const resetBtn = document.getElementById("resetBtn");

  // 해외 주식 전용 DOM
  const exchangeRateInput = document.getElementById("exchangeRate");
  const rateStatusEl = document.getElementById("rateStatus");

  // 공통 결과 출력 DOM
  const resAnnualAfterTax = document.getElementById("resAnnualAfterTax");
  const resAnnualPreTax = document.getElementById("resAnnualPreTax");
  const resAnnualTax = document.getElementById("resAnnualTax");
  const resPerPayoutAfterTax = document.getElementById("resPerPayoutAfterTax");
  const resMonthlyAvg = document.getElementById("resMonthlyAvg");
  const resEffectiveRate = document.getElementById("resEffectiveRate");
  const resTaxSaved = document.getElementById("resTaxSaved");
  const resAppliedBadge = document.getElementById("resAppliedBadge");
  const resAppliedDesc = document.getElementById("resAppliedDesc");
  const resCompTaxWarning = document.getElementById("resCompTaxWarning");

  // 해외 주식 현지 통화 결과 DOM
  const resAnnualAfterTaxLocal = document.getElementById("resAnnualAfterTaxLocal");
  const resAnnualPreTaxLocal = document.getElementById("resAnnualPreTaxLocal");
  const resAnnualTaxLocal = document.getElementById("resAnnualTaxLocal");
  const resPerPayoutAfterTaxLocal = document.getElementById("resPerPayoutAfterTaxLocal");
  const resMonthlyAvgLocal = document.getElementById("resMonthlyAvgLocal");

  if (!dpsInput || !qtyInput) return;

  function getSelectedFrequency() {
    const checked = document.querySelector('input[name="frequency"]:checked');
    return checked ? Number(checked.value) : 4;
  }

  function getSelectedTaxRule() {
    const checked = document.querySelector('input[name="taxExemption"]:checked');
    return checked ? checked.value : TAX_RULES.STANDARD.id;
  }

  function updateCalculation() {
    const taxRuleId = getSelectedTaxRule();

    if (isForeign) {
      const result = calculateForeignDividend({
        marketCode,
        dividendPerShare: dpsInput.value,
        quantity: qtyInput.value,
        frequency: getSelectedFrequency(),
        exchangeRate: exchangeRateInput ? exchangeRateInput.value : marketConfig.defaultRate,
        taxRuleId,
        customRate: customRateInput ? customRateInput.value : 0,
      });

      resAnnualAfterTax.textContent = formatKRW(result.annualAfterTaxKRW);
      resAnnualPreTax.textContent = formatKRW(result.annualPreTaxKRW);
      resAnnualTax.textContent = `-${formatKRW(result.annualTaxKRW)}`;
      resPerPayoutAfterTax.textContent = formatKRW(result.perPayoutAfterTaxKRW);
      resMonthlyAvg.textContent = formatKRW(result.monthlyAvgAfterTaxKRW);
      resEffectiveRate.textContent = `${result.effectiveTaxRate.toFixed(3).replace(/\.?0+$/, "")}%`;

      if (resAnnualAfterTaxLocal) resAnnualAfterTaxLocal.textContent = formatForeign(result.annualAfterTaxLocal, marketCode);
      if (resAnnualPreTaxLocal) resAnnualPreTaxLocal.textContent = formatForeign(result.annualPreTaxLocal, marketCode);
      if (resAnnualTaxLocal) resAnnualTaxLocal.textContent = `-${formatForeign(result.annualTaxLocal, marketCode)}`;
      if (resPerPayoutAfterTaxLocal) resPerPayoutAfterTaxLocal.textContent = formatForeign(result.perPayoutAfterTaxLocal, marketCode);
      if (resMonthlyAvgLocal) resMonthlyAvgLocal.textContent = formatForeign(result.monthlyAvgAfterTaxLocal, marketCode);

      resAppliedBadge.textContent = result.appliedRuleLabel;
      resAppliedDesc.textContent = result.appliedRuleDesc;
      if (resCompTaxWarning) {
        resCompTaxWarning.classList.toggle("hidden", !result.isComprehensiveTaxTarget);
      }
      return;
    }

    // 국내 주식 계산
    const result = calculateDividend({
      dividendPerShare: dpsInput.value,
      quantity: qtyInput.value,
      frequency: getSelectedFrequency(),
      taxRuleId,
      customRate: customRateInput ? customRateInput.value : 0,
    });

    resAnnualAfterTax.textContent = formatKRW(result.annualAfterTax);
    resAnnualPreTax.textContent = formatKRW(result.annualPreTax);
    resAnnualTax.textContent = `-${formatKRW(result.annualTax)}`;
    resPerPayoutAfterTax.textContent = formatKRW(result.perPayoutAfterTax);
    resMonthlyAvg.textContent = formatKRW(result.monthlyAvgAfterTax);
    resEffectiveRate.textContent = `${result.effectiveTaxRate.toFixed(2)}%`;
    if (resTaxSaved) resTaxSaved.textContent = formatKRW(result.taxSaved);
    resAppliedBadge.textContent = result.appliedRuleLabel;
    resAppliedDesc.textContent = result.appliedRuleDesc;
    if (resCompTaxWarning) {
      resCompTaxWarning.classList.toggle("hidden", !result.isComprehensiveTaxTarget);
    }
  }

  // 해외 주식 페이지 접속 시 무료 환율 API 자동 호출
  async function fetchLiveExchangeRate() {
    if (!isForeign || !exchangeRateInput) return;

    exchangeRateInput.value = marketConfig.defaultRate;
    if (rateStatusEl) rateStatusEl.textContent = "최신 환율 불러오는 중...";

    try {
      const response = await fetch(marketConfig.rateApiUrl);
      if (!response.ok) throw new Error("API 응답 오류");
      const data = await response.json();

      if (data && data.rates && data.rates.KRW) {
        const fetchedRate = Number((data.rates.KRW * marketConfig.rateUnit).toFixed(2));
        exchangeRateInput.value = fetchedRate;
        if (rateStatusEl) {
          rateStatusEl.textContent = `실시간 기준 환율 자동 적용 (직접 수정 가능)`;
        }
        updateCalculation();
      } else {
        throw new Error("환율 데이터 누락");
      }
    } catch {
      if (rateStatusEl) {
        rateStatusEl.textContent = `기본 환율 적용됨 (원하는 환율로 직접 수정 가능)`;
      }
    }
  }

  taxCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        taxCheckboxes.forEach((other) => {
          if (other !== e.target) other.checked = false;
        });
      }
      const customCb = document.getElementById("tax_custom");
      if (customCb && customRateWrap) {
        customRateWrap.classList.toggle("hidden", !customCb.checked);
      }
      updateCalculation();
    });
  });

  [dpsInput, qtyInput, customRateInput, exchangeRateInput].forEach((input) => {
    if (input) input.addEventListener("input", updateCalculation);
  });

  freqRadios.forEach((radio) => {
    radio.addEventListener("change", updateCalculation);
  });

  resetBtn.addEventListener("click", () => {
    dpsInput.value = "";
    qtyInput.value = "";
    if (customRateInput) customRateInput.value = "";
    document.getElementById("freq_4").checked = true;
    taxCheckboxes.forEach((cb) => (cb.checked = false));
    if (customRateWrap) customRateWrap.classList.add("hidden");
    updateCalculation();
  });

  updateCalculation();
  fetchLiveExchangeRate();
});