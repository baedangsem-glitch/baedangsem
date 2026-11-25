import { MARKETS, TAX_RULES } from "./config.js";

/**
 * 10원 미만 절사 함수 (국세기본법 기준)
 * 예: 1,548원 -> 1,540원
 */
function floorTo10(amount) {
  return Math.floor(amount / 10) * 10;
}

/**
 * 국세 + 지방소득세(국세의 10%) 각각 10원 미만 절사 합산 함수
 * @param {number} taxableAmount - 과세 대상 금액
 * @param {number} nationalRate - 국세율 (일반주 0.14, 리츠/ISA 0.09)
 */
function calcSplitTax(taxableAmount, nationalRate) {
  const nationalTax = floorTo10(taxableAmount * nationalRate);
  const localTax = floorTo10(nationalTax * 0.1);
  return nationalTax + localTax;
}

/**
 * 국내 주식 배당금 및 세금 계산 함수
 */
export function calculateDividend({
  dividendPerShare,
  quantity,
  frequency,
  taxRuleId = TAX_RULES.STANDARD.id,
  customRate = 0,
}) {
  const safeDps = Math.max(0, Number(dividendPerShare) || 0);
  const safeQty = Math.max(0, Number(quantity) || 0);
  const safeFreq = Math.max(1, Number(frequency) || 1);

  const perPayoutPreTax = safeDps * safeQty;
  const annualPreTax = perPayoutPreTax * safeFreq;

  let perPayoutTax = 0;
  let annualTax = 0;
  let appliedRuleLabel = TAX_RULES.STANDARD.label;
  let appliedRuleDesc = TAX_RULES.STANDARD.description;

  switch (taxRuleId) {
    case TAX_RULES.COVERED_CALL_LOSS.id:
      perPayoutTax = 0;
      annualTax = 0;
      appliedRuleLabel = TAX_RULES.COVERED_CALL_LOSS.label;
      appliedRuleDesc = TAX_RULES.COVERED_CALL_LOSS.description;
      break;

    case TAX_RULES.REIT_SEPARATE.id:
      // 공모 리츠 분리과세: 국세 9% + 지방소득세 0.9% (1회 지급 기준 각각 10원 미만 절사)
      perPayoutTax = calcSplitTax(perPayoutPreTax, 0.09);
      annualTax = perPayoutTax * safeFreq;
      appliedRuleLabel = TAX_RULES.REIT_SEPARATE.label;
      appliedRuleDesc = TAX_RULES.REIT_SEPARATE.description;
      break;

    case TAX_RULES.ISA_GENERAL.id: {
      // ISA 일반형: 연간 합산 200만 원 초과분에 9.9% (국세 9% + 지방세 0.9%)
      const taxable = Math.max(0, annualPreTax - TAX_RULES.ISA_GENERAL.exemptLimit);
      annualTax = calcSplitTax(taxable, 0.09);
      perPayoutTax = floorTo10(annualTax / safeFreq);
      appliedRuleLabel = TAX_RULES.ISA_GENERAL.label;
      appliedRuleDesc = TAX_RULES.ISA_GENERAL.description;
      break;
    }

    case TAX_RULES.ISA_LOW_INCOME.id: {
      // ISA 서민형: 연간 합산 400만 원 초과분에 9.9% (국세 9% + 지방세 0.9%)
      const taxable = Math.max(0, annualPreTax - TAX_RULES.ISA_LOW_INCOME.exemptLimit);
      annualTax = calcSplitTax(taxable, 0.09);
      perPayoutTax = floorTo10(annualTax / safeFreq);
      appliedRuleLabel = TAX_RULES.ISA_LOW_INCOME.label;
      appliedRuleDesc = TAX_RULES.ISA_LOW_INCOME.description;
      break;
    }

    case TAX_RULES.PENSION_IRP.id:
      perPayoutTax = 0;
      annualTax = 0;
      appliedRuleLabel = TAX_RULES.PENSION_IRP.label;
      appliedRuleDesc = TAX_RULES.PENSION_IRP.description;
      break;

    case TAX_RULES.TAX_FREE_SAVINGS.id:
      perPayoutTax = 0;
      annualTax = 0;
      appliedRuleLabel = TAX_RULES.TAX_FREE_SAVINGS.label;
      appliedRuleDesc = TAX_RULES.TAX_FREE_SAVINGS.description;
      break;

    case TAX_RULES.CUSTOM.id: {
      const clampedRate = Math.min(100, Math.max(0, Number(customRate) || 0));
      perPayoutTax = floorTo10(perPayoutPreTax * (clampedRate / 100));
      annualTax = perPayoutTax * safeFreq;
      appliedRuleLabel = `사용자 지정 세율 (${clampedRate}%)`;
      appliedRuleDesc = TAX_RULES.CUSTOM.description;
      break;
    }

    case TAX_RULES.STANDARD.id:
    default:
      // 일반주/우선주: 국세 14% + 지방소득세 1.4% (1회 지급 기준 각각 10원 미만 절사)
      perPayoutTax = calcSplitTax(perPayoutPreTax, 0.14);
      annualTax = perPayoutTax * safeFreq;
      appliedRuleLabel = TAX_RULES.STANDARD.label;
      appliedRuleDesc = TAX_RULES.STANDARD.description;
      break;
  }

  const annualAfterTax = Math.max(0, annualPreTax - annualTax);
  const perPayoutAfterTax = Math.max(0, perPayoutPreTax - perPayoutTax);
  const monthlyAvgAfterTax = Math.floor(annualAfterTax / 12);
  const effectiveTaxRate = annualPreTax > 0 ? (annualTax / annualPreTax) * 100 : 0;

  // 일반 과세(15.4%, 10원 미만 절사 기준) 대비 절세 금액
  const standardAnnualTax = calcSplitTax(perPayoutPreTax, 0.14) * safeFreq;
  const taxSaved = Math.max(0, standardAnnualTax - annualTax);

  // 금융소득종합과세 대상 여부 (일반 과세 기준 연간 세전 2,000만 원 초과 시 true)
  const isComprehensiveTaxTarget =
    taxRuleId === TAX_RULES.STANDARD.id && annualPreTax > 20000000;

  return {
    perPayoutPreTax,
    perPayoutTax,
    perPayoutAfterTax,
    annualPreTax,
    annualTax,
    annualAfterTax,
    monthlyAvgAfterTax,
    effectiveTaxRate,
    taxSaved,
    appliedRuleLabel,
    appliedRuleDesc,
    isComprehensiveTaxTarget,
  };
}

/**
 * 해외 주식(미국·일본) 배당금 및 세금 계산 함수
 */
export function calculateForeignDividend({
  marketCode,
  dividendPerShare,
  quantity,
  frequency,
  exchangeRate,
  taxRuleId = TAX_RULES.STANDARD.id,
  customRate = 0,
}) {
  const market = MARKETS[marketCode] || MARKETS.US;
  const safeDps = Math.max(0, Number(dividendPerShare) || 0);
  const safeQty = Math.max(0, Number(quantity) || 0);
  const safeFreq = Math.max(1, Number(frequency) || 1);
  const safeRate = Math.max(0, Number(exchangeRate) || 0);

  // 현지 통화 1단위당 원화 환율 (미국: rate / 1, 일본: rate / 100)
  const krwPerLocal = safeRate / market.rateUnit;

  let appliedTaxRate = market.defaultTaxRate;
  let appliedRuleLabel = market.defaultLabel;
  let appliedRuleDesc = market.defaultDesc;

  if (taxRuleId === TAX_RULES.CUSTOM.id) {
    const clampedRate = Math.min(100, Math.max(0, Number(customRate) || 0));
    appliedTaxRate = clampedRate / 100;
    appliedRuleLabel = `사용자 지정 세율 (${clampedRate}%)`;
    appliedRuleDesc = "특수 종목(MLP, ROC 등) 또는 직접 입력한 세율을 적용하여 계산합니다.";
  }

  // 현지 통화 기준 계산
  const perPayoutPreTaxLocal = safeDps * safeQty;
  const annualPreTaxLocal = perPayoutPreTaxLocal * safeFreq;
  const annualTaxLocal = annualPreTaxLocal * appliedTaxRate;
  const annualAfterTaxLocal = Math.max(0, annualPreTaxLocal - annualTaxLocal);
  const perPayoutAfterTaxLocal = Math.max(0, perPayoutPreTaxLocal * (1 - appliedTaxRate));
  const monthlyAvgAfterTaxLocal = annualAfterTaxLocal / 12;

  // 원화 환산 계산
  const annualPreTaxKRW = Math.round(annualPreTaxLocal * krwPerLocal);
  const annualTaxKRW = Math.round(annualTaxLocal * krwPerLocal);
  const annualAfterTaxKRW = Math.max(0, annualPreTaxKRW - annualTaxKRW);
  const perPayoutAfterTaxKRW = Math.round(perPayoutAfterTaxLocal * krwPerLocal);
  const monthlyAvgAfterTaxKRW = Math.floor(annualAfterTaxKRW / 12);

  const effectiveTaxRate = appliedTaxRate * 100;
  // 해외 배당금도 원화 환산 연 2,000만 원 초과 시 금융소득종합과세 대상
  const isComprehensiveTaxTarget = annualPreTaxKRW > 20000000;

  return {
    annualPreTaxLocal,
    annualTaxLocal,
    annualAfterTaxLocal,
    perPayoutAfterTaxLocal,
    monthlyAvgAfterTaxLocal,
    annualPreTaxKRW,
    annualTaxKRW,
    annualAfterTaxKRW,
    perPayoutAfterTaxKRW,
    monthlyAvgAfterTaxKRW,
    effectiveTaxRate,
    appliedRuleLabel,
    appliedRuleDesc,
    isComprehensiveTaxTarget,
  };
}
/**
 * 국내 채권(국채·회사채) 이자 및 만기 매매차익 계산 함수
 */
export function calculateBond({
  faceValue,
  buyPricePer10k,
  couponRate,
  frequency,
  monthsToMaturity,
  taxRuleId = TAX_RULES.STANDARD.id,
  customRate = 0,
}) {
  const safeFace = Math.max(0, Number(faceValue) || 0);
  // 매수 단가가 비어 있거나 0 이하이면 액면가(10,000원) 매수로 간주
  const rawPrice = Number(buyPricePer10k);
  const safeBuyPrice = rawPrice > 0 ? rawPrice : 10000;
  const safeCoupon = Math.max(0, Number(couponRate) || 0);
  const safeFreq = Math.max(1, Number(frequency) || 4);
  const safeMonths = Math.max(1, Number(monthsToMaturity) || 12);
  const years = safeMonths / 12;

  // 실제 투자 원금 및 만기 상환 매매차익(비과세)
  const actualInvestAmount = Math.round(safeFace * (safeBuyPrice / 10000));
  const capitalGain = safeFace - actualInvestAmount;

  // 표면금리 기준 세전 이자
  const annualPreTaxInterest = safeFace * (safeCoupon / 100);
  const perPayoutPreTaxInterest = annualPreTaxInterest / safeFreq;

  let perPayoutTax = 0;
  let annualTax = 0;
  let appliedRuleLabel = "일반 계좌 과세 (기본 15.4%)";
  let appliedRuleDesc = "이자소득세 14% + 지방소득세 1.4%가 적용되며, 만기 매매차익은 비과세입니다.";

  switch (taxRuleId) {
    case TAX_RULES.ISA_GENERAL.id: {
      const taxable = Math.max(0, annualPreTaxInterest - TAX_RULES.ISA_GENERAL.exemptLimit);
      annualTax = calcSplitTax(taxable, 0.09);
      perPayoutTax = floorTo10(annualTax / safeFreq);
      appliedRuleLabel = TAX_RULES.ISA_GENERAL.label;
      appliedRuleDesc = "연간 이자·배당소득 200만 원 비과세, 초과분 9.9% 분리과세가 적용됩니다.";
      break;
    }

    case TAX_RULES.ISA_LOW_INCOME.id: {
      const taxable = Math.max(0, annualPreTaxInterest - TAX_RULES.ISA_LOW_INCOME.exemptLimit);
      annualTax = calcSplitTax(taxable, 0.09);
      perPayoutTax = floorTo10(annualTax / safeFreq);
      appliedRuleLabel = TAX_RULES.ISA_LOW_INCOME.label;
      appliedRuleDesc = "연간 이자·배당소득 400만 원 비과세, 초과분 9.9% 분리과세가 적용됩니다.";
      break;
    }

    case TAX_RULES.PENSION_IRP.id:
      perPayoutTax = 0;
      annualTax = 0;
      appliedRuleLabel = TAX_RULES.PENSION_IRP.label;
      appliedRuleDesc = "이자 수령 시 원천징수 없이 과세이연되며 추후 연금 수령 시 저율 과세됩니다.";
      break;

    case TAX_RULES.TAX_FREE_SAVINGS.id:
      perPayoutTax = 0;
      annualTax = 0;
      appliedRuleLabel = TAX_RULES.TAX_FREE_SAVINGS.label;
      appliedRuleDesc = "비과세 종합저축 한도 내 채권 이자소득에 대해 세금이 면제됩니다.";
      break;

    case TAX_RULES.CUSTOM.id: {
      const clampedRate = Math.min(100, Math.max(0, Number(customRate) || 0));
      perPayoutTax = floorTo10(perPayoutPreTaxInterest * (clampedRate / 100));
      annualTax = perPayoutTax * safeFreq;
      appliedRuleLabel = `사용자 지정 세율 (${clampedRate}%)`;
      appliedRuleDesc = "입력하신 이자소득세율을 적용하며, 만기 매매차익은 비과세로 합산합니다.";
      break;
    }

    case TAX_RULES.STANDARD.id:
    default:
      perPayoutTax = calcSplitTax(perPayoutPreTaxInterest, 0.14);
      annualTax = perPayoutTax * safeFreq;
      break;
  }

  const perPayoutAfterTaxInterest = Math.max(0, Math.round(perPayoutPreTaxInterest - perPayoutTax));
  const annualAfterTaxInterest = Math.max(0, Math.round(annualPreTaxInterest - annualTax));

  // 잔존 만기 전체 기준 합산
  const totalPreTaxInterest = Math.round(annualPreTaxInterest * years);
  const totalTax = Math.round(annualTax * years);
  const totalAfterTaxInterest = Math.max(0, totalPreTaxInterest - totalTax);

  // 총 세후 순수익 (세후 이자 + 비과세 매매차익) 및 연환산 세후 수익률
  const totalNetProfit = totalAfterTaxInterest + capitalGain;
  const totalMaturityPayout = safeFace + totalAfterTaxInterest;
  const annualizedAfterTaxYield =
    actualInvestAmount > 0 && years > 0
      ? (totalNetProfit / actualInvestAmount / years) * 100
      : 0;

  const isComprehensiveTaxTarget =
    taxRuleId === TAX_RULES.STANDARD.id && annualPreTaxInterest > 20000000;

  return {
    actualInvestAmount,
    capitalGain,
    perPayoutAfterTaxInterest,
    annualPreTaxInterest: Math.round(annualPreTaxInterest),
    annualTax: Math.round(annualTax),
    annualAfterTaxInterest,
    totalAfterTaxInterest,
    totalTax,
    totalNetProfit,
    totalMaturityPayout,
    annualizedAfterTaxYield,
    appliedRuleLabel,
    appliedRuleDesc,
    isComprehensiveTaxTarget,
  };
}