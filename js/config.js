export const SITE_CONFIG = {
  siteName: "배당셈",
  domain: "https://your-domain.pages.dev",
  contactEmail: "baedangsem@gmail.com",
  lastUpdated: "2026-11-25",
};

export const MARKETS = {
  KR: {
    code: "KR",
    name: "국내 주식",
    currency: "KRW",
    symbol: "원",
    defaultTaxRate: 0.154,
  },
  US: {
    code: "US",
    name: "미국 주식",
    currency: "USD",
    symbol: "$",
    defaultTaxRate: 0.15, // 한미 조세조약 배당소득세 15%
    defaultRate: 1400,    // API 실패 시 기본 환율 (1달러당 원화)
    rateUnit: 1,
    rateApiUrl: "https://open.er-api.com/v6/latest/USD",
    defaultLabel: "미국 현지 원천징수 (기본 15%)",
    defaultDesc: "한미 조세조약에 따라 미국 배당소득세 15%가 현지 원천징수됩니다.",
  },
  JP: {
    code: "JP",
    name: "일본 주식",
    currency: "JPY",
    symbol: "¥",
    defaultTaxRate: 0.15315, // 일본 배당소득세 15.315% (부흥특별소득세 포함)
    defaultRate: 920,        // API 실패 시 기본 환율 (100엔당 원화)
    rateUnit: 100,
    rateApiUrl: "https://open.er-api.com/v6/latest/JPY",
    defaultLabel: "일본 현지 원천징수 (기본 15.315%)",
    defaultDesc: "일본 상장 주식 및 ETF 배당금에는 현지 세율 15.315%가 원천징수됩니다.",
  },
};

export const TAX_RULES = {
  STANDARD: {
    id: "standard",
    label: "일반주 / 우선주 (기본 15.4%)",
    rate: 0.154,
    description: "일반 계좌 기준 배당소득세 14% + 지방소득세 1.4%가 적용됩니다.",
  },
  COVERED_CALL_LOSS: {
    id: "covered_call_loss",
    label: "커버드콜 손실 중 (비과세 0%)",
    rate: 0,
    description: "옵션 프리미엄 기반 분배금 등 비과세 요건 충족 시 0%가 적용됩니다.",
  },
  REIT_SEPARATE: {
    id: "reit_separate",
    label: "공모 리츠(ETF) 분리과세 (9.9%)",
    rate: 0.099,
    description: "공모 리츠 투자금 5,000만 원 한도 내 9.9% 분리과세 기준이 적용됩니다.",
  },
  ISA_GENERAL: {
    id: "isa_general",
    label: "ISA 계좌 - 일반형 (200만 원 비과세, 초과 9.9%)",
    exemptLimit: 2000000,
    excessRate: 0.099,
    description: "연간 배당소득 200만 원까지 비과세, 초과 금액에 9.9% 분리과세가 적용됩니다.",
  },
  ISA_LOW_INCOME: {
    id: "isa_low_income",
    label: "ISA 계좌 - 서민형 (400만 원 비과세, 초과 9.9%)",
    exemptLimit: 4000000,
    excessRate: 0.099,
    description: "연간 배당소득 400만 원까지 비과세, 초과 금액에 9.9% 분리과세가 적용됩니다.",
  },
  PENSION_IRP: {
    id: "pension_irp",
    label: "연금저축 / IRP 계좌 (과세이연 0%)",
    rate: 0,
    description: "배당 수령 시점에 세금을 징수하지 않고 추후 연금 수령 시 저율 과세됩니다.",
  },
  TAX_FREE_SAVINGS: {
    id: "tax_free_savings",
    label: "비과세 종합저축 (비과세 0%)",
    rate: 0,
    description: "비과세 종합저축 한도 내 배당소득에 대해 세금이 면제됩니다.",
  },
  CUSTOM: {
    id: "custom",
    label: "직접 세율 입력 (%)",
    description: "사용자가 입력한 세율을 직접 적용하여 계산합니다.",
  },
};