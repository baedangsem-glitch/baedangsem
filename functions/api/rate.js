export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const market = (url.searchParams.get("market") || "US").toUpperCase();

  const marketMap = {
    US: { symbol: "KRW=X", unit: 1 },
    JP: { symbol: "JPYKRW=X", unit: 100 },
  };

  const target = marketMap[market];
  if (!target) {
    return new Response(JSON.stringify({ error: "지원하지 않는 시장 코드입니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    target.symbol
  )}?interval=1m&range=1d`;

  try {
    const response = await fetch(yahooUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      cf: {
        cacheTtl: 60,
        cacheEverything: true,
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API 오류: ${response.status}`);
    }

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const rawPrice = meta?.regularMarketPrice;

    if (typeof rawPrice !== "number" || rawPrice <= 0) {
      throw new Error("유효한 환율 데이터를 찾지 못했습니다.");
    }

    const rate = Number((rawPrice * target.unit).toFixed(2));
    const marketTimeMs = meta?.regularMarketTime
      ? meta.regularMarketTime * 1000
      : Date.now();

    return new Response(
      JSON.stringify({
        market,
        rate,
        updatedAt: new Date(marketTimeMs).toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=60, s-maxage=60",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "실시간 환율 조회에 실패했습니다." }),
      {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}