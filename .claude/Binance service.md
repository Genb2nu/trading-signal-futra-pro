##sample binance api

public static class BinanceService
    {
        private readonly static string binanceUrl = "https://api3.binance.com/api";

        public static List<BEKline> GetBEKlines(string symbol, string interval, string startTime, string endTime, string limit)
        {
            var klineUrl = $"{binanceUrl}/v3/klines?symbol={symbol}&interval={interval}&limit={limit}";
            if (!string.IsNullOrEmpty(startTime))
                klineUrl += $"&starttime={startTime}";
            if (!string.IsNullOrEmpty(endTime))
                klineUrl += $"&endTime={endTime}";

            using (var client = new HttpClient())
            {
                var result = client.GetAsync(klineUrl).Result;
                var content = result.Content?.ReadAsStringAsync().Result;
                return content.ToBeKline();
            }
        }

        public static ExchangeInfo GetSymbols()
        {
            var exchangeInfoUrl = $"{binanceUrl}/v3/exchangeInfo?";

            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            };

            using (var client = new HttpClient())
            {
                var result = client.GetAsync(exchangeInfoUrl).Result;
                var content = result.Content?.ReadAsStringAsync().Result;
                var jsonModel = JsonSerializer.Deserialize<ExchangeInfo>(content, options);
                return jsonModel;
            }
        }
    }


var ExchangeInfo = BinanceService.GetSymbols();
var usdSpotOnly = ExchangeInfo.Symbols.Where( c.QuoteAsset == "USDT").ToList();