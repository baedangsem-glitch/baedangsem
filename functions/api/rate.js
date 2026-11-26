export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const market = (url.searchParams.get("market") || "US").toUpperCase();

  if (market !== "US" && market !== "JP") {
    return jsonResponse({ error: "지원하지 않는 시장 코드입니다. (US 또는 JP만 가능)" }, 400);
  }

  let rate = null;
  let source = "";

  // 1순위: 네이버 금융 (하나은행 고시환율)
  try {
    rate = await fetchNaverHanaRate(market);
    if (rate) source = "naver-hana";
  } catch (_) {
    // 2순위로 자동 전환
  }

  // 2순위: 야후 파이낸스 (일본 엔화는 KRW=X / JPY=X * 100 재정환율 공식 적용)
  if (!rate) {
    try {
      rate = await fetchYahooCrossRate(market);
      if (rate) source = "yahoo-cross";
    } catch (_) {
      // 3순위로 자동 전환
    }
  }

  // 3순위: 일일 기준 환율 백업 API
  if (!rate) {
    try {
      rate = await fetchBackupDailyRate(market);
      if (rate) source = "backup-daily";
    } catch (_) {
      // 모든 소스 실패
    }
  }

  if (!rate) {
    return jsonResponse({ error: "환율 정보를 불러오지 못했습니다." }, 502);
  }

  return jsonResponse({
    market,
    rate: Number(rate.toFixed(2)),
    source,
    updatedAt: new Date().toISOString()
  });
}

function parsePrice(val) {
  if (val === undefined || val === null) return NaN;
  return parseFloat(String(val).replace(/,/g, ""));
}

async function fetchNaverHanaRate(market) {
  const reutersCode = market === "JP" ? "FX_JPYKRW" : "FX_USDKRW";
  const endpoint = `https://api.stock.naver.com/marketindex/exchange/${reutersCode}`;

  const res = await fetch(endpoint, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://m.stock.naver.com/",
      "Accept": "application/json"
    }
  });

  if (!res.ok) throw new Error(`Naver HTTP ${res.status}`);
  const data = await res.json();

  const raw =
    data?.exchangeInfo?.calcPrice ??
    data?.exchangeInfo?.closePrice ??
    data?.result?.calcPrice ??
    data?.result?.closePrice;

  let price = parsePrice(raw);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Invalid Naver rate payload");
  }

  // 혹시 1엔 단위로 반환될 경우 100엔 단위로 보정
  if (market === "JP" && price < 50) {
    price *= 100;
  }

  return price;
}

async function fetchYahooSymbol(symbol) {
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const res = await fetch(endpoint, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });

  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid Yahoo price for ${symbol}`);
  }
  return price;
}

async function fetchYahooCrossRate(market) {
  if (market === "US") {
    return await fetchYahooSymbol("KRW=X");
  }

  const [usdKrw, usdJpy] = await Promise.all([
    fetchYahooSymbol("KRW=X"),
    fetchYahooSymbol("JPY=X")
  ]);

  return (usdKrw / usdJpy) * 100;
}

async function fetchBackupDailyRate(market) {
  const base = market === "JP" ? "JPY" : "USD";
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  if (!res.ok) throw new Error(`Backup HTTP ${res.status}`);

  const data = await res.json();
  const krw = data?.rates?.KRW;
  if (!Number.isFinite(krw) || krw <= 0) {
    throw new Error("Invalid backup rate");
  }

  return market === "JP" ? krw * 100 : krw;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*"
    }
  });
}