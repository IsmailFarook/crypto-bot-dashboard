(function () {
  "use strict";
  var data = null;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); };
  var num = function (v) { return Math.round(v).toLocaleString("en-MY"); };
  var rm = function (v) { return "RM" + Number(v).toLocaleString("en-MY", {minimumFractionDigits: 2, maximumFractionDigits: 2}); };
  var pct = function (v) { return (v > 0 ? "+" : "") + Number(v).toFixed(2) + "%"; };
  var cls = function (v) { return v > 0 ? "pos" : v < 0 ? "neg" : ""; };
  var signedRm = function (v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + rm(Math.abs(v)); };
  function ago(ms) {
    var m = Math.max(0, Math.round(ms / 60000));
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.floor(m / 60);
    if (h < 48) return h + " h " + (m % 60) + " min ago";
    return Math.floor(h / 24) + " days ago";
  }
  function money(v, p) { return data.showRinggit ? rm(v) : pct(p); }

  function render() {
    var d = data, now = Date.now();
    $("updated").textContent = "Last updated " + d.publishedAt + " MYT (" + ago(now - d.publishedTs) + ")";
    var hbAge = now - d.heartbeatTs;
    var st = $("stale");
    if (hbAge > 7 * 3600 * 1000) { st.textContent = "This update is more than 6 hours old. The bot may be stopped or unable to publish."; st.classList.remove("hidden"); }
    else st.classList.add("hidden");

    var cards = d.strategies.map(function (s) {
      return '<div class="card"><div class="l">' + esc(s.name) + '</div><div class="v">' + money(s.equity, s.ret) + '</div><div class="d ' + cls(s.ret) + '">' + pct(s.ret) + ' · ' + s.trades + ' trades</div></div>';
    });
    cards.push('<div class="card"><div class="l">Buy and hold BTC</div><div class="v">' + money(d.buyHold, d.buyHoldRet) + '</div><div class="d ' + cls(d.buyHoldRet) + '">' + pct(d.buyHoldRet) + ' after fees</div></div>');
    cards.push('<div class="card"><div class="l">BTC/MYR at update</div><div class="v">' + num(d.price) + '</div><div class="d ' + cls(d.btcChange) + '">' + pct(d.btcChange) + ' since start</div></div>');
    $("cards").innerHTML = cards.join("");

    chart(d.history);

    $("strats").innerHTML = d.strategies.map(function (s) {
      var pill = s.halted ? '<span class="pill warn">Halted: ' + esc(s.haltReason || "paused") + '</span>' : '<span class="pill ok">Trading</span>';
      var pos;
      if (s.pos) pos = (s.pos.size != null ? s.pos.size.toFixed(6) + " BTC " : "Holding BTC ") + "from " + num(s.pos.entry) + ", stop " + num(s.pos.stop) + (s.pos.tp ? ", target " + num(s.pos.tp) : "") + " (since " + esc(s.pos.opened.slice(5, 16)) + ")";
      else if (s.pending) pos = "Waiting: demo limit buy at " + num(s.pending.price);
      else pos = "No position";
      var rows = [["Position", esc(pos)],
        ["Today", d.showRinggit ? '<span class="' + cls(s.today) + '">' + signedRm(s.today) + '</span>' : '<span class="' + cls(s.todayPct) + '">' + pct(s.todayPct) + '</span>'],
        ["Win rate", s.win == null ? "No closed trades" : s.win + "% of " + s.trades]];
      if (d.showRinggit) rows.push(["Cash", rm(s.cash)]);
      return '<div class="strat"><h3>' + esc(s.name) + pill + '</h3><dl class="kv">' + rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>"; }).join("") + "</dl></div>";
    }).join("");
    var g = d.signals;
    $("signal").textContent = g.scTrendOk
      ? "1-hour trend is not falling: the scalper may buy the next dip (15-min RSI " + (g.rsi15 == null ? "–" : g.rsi15) + ", buys at 30 or lower)."
      : "1-hour trend is down (EMA20 " + num(g.ema20) + " below EMA50 " + num(g.ema50) + "), so both strategies are sitting out. That is the rules working, not a fault.";

    var h = [["Bot", d.running ? '<span class="pill ok">Running</span>' : '<span class="pill bad">Stopped</span>'],
      ["Last heartbeat", esc(d.heartbeat) + " MYT"],
      ["Kill switch", d.killSwitch ? '<span class="pill warn">Active: no new trades</span>' : "Not triggered"],
      ["Price checks", Number(d.loops).toLocaleString("en-MY")],
      ["Started", esc(d.startedAt) + " MYT at " + num(d.startPrice)]];
    $("health").innerHTML = h.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>"; }).join("");

    var t = d.trades;
    $("tradecount").textContent = t.length ? "(" + t.length + ", newest first, MYT)" : "";
    $("notrades").classList.toggle("hidden", t.length > 0);
    $("trades").classList.toggle("hidden", t.length === 0);
    if (t.length) {
      var head = d.showRinggit ? ["Time", "Strategy", "Side", "Price", "BTC", "Fee", "Profit", "Reason"] : ["Time", "Strategy", "Side", "Price", "Profit", "Reason"];
      $("trades").innerHTML = "<thead><tr>" + head.map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr></thead><tbody>" +
        t.map(function (r) {
          var p = d.showRinggit ? (r.pnl == null ? "" : '<span class="' + cls(r.pnl) + '">' + signedRm(r.pnl) + "</span>") : (r.pnlPct == null ? "" : '<span class="' + cls(r.pnlPct) + '">' + pct(r.pnlPct) + "</span>");
          var cells = [esc(r.t), r.s === "scalper" ? "Scalper" : "Trend", r.side, num(r.price)];
          if (d.showRinggit) cells.push(r.size.toFixed(6), rm(r.fee));
          cells.push(p);
          return "<tr>" + cells.map(function (c) { return "<td>" + c + "</td>"; }).join("") + '<td class="why">' + esc(r.why) + "</td></tr>";
        }).join("") + "</tbody>";
    }

    var a = d.alerts;
    $("noalerts").classList.toggle("hidden", a.length > 0);
    var names = {kill_switch: "Kill switch", daily_loss_limit: "Daily loss limit", api_error: "Connection problem", info: "Info"};
    $("alerts").innerHTML = a.map(function (x) {
      return '<li><span class="tag ' + esc(x.type) + '">' + esc(names[x.type] || x.type) + '</span><span class="t">' + esc(x.time) + " MYT</span><br>" + esc(x.message) + "</li>";
    }).join("");
  }

  function chart(hist) {
    var series = [
      {k: "sc", name: "Slow scalper", c: "var(--c1)"},
      {k: "tf", name: "Trend following", c: "var(--c2)"},
      {k: "bh", name: "Buy and hold", c: "var(--c3)", dash: true}];
    $("legend").innerHTML = series.map(function (s) { return '<span><i style="background:' + s.c + '"></i>' + s.name + "</span>"; }).join("");
    if (!hist || hist.length < 2) { $("chart").innerHTML = '<p class="note">The chart appears after the first few balance points (one every 5 minutes).</p>'; return; }
    var W = Math.max(320, Math.round($("chart").clientWidth || 720)), H = W < 500 ? 220 : 260, L = 56, R = 10, T = 10, B = 28;
    var vals = [];
    hist.forEach(function (p) { series.forEach(function (s) { vals.push(p[s.k]); }); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = Math.max((hi - lo) * 0.1, data.showRinggit ? 2 : 0.2); lo -= pad; hi += pad;
    var x = function (i) { return L + (W - L - R) * i / (hist.length - 1); };
    var y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Balance over time">';
    for (var i = 0; i <= 4; i++) {
      var v = lo + (hi - lo) * i / 4, yy = y(v);
      svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line)"/>';
      svg += '<text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="12" fill="var(--mut)">' + (data.showRinggit ? Math.round(v) : v.toFixed(1) + "%") + "</text>";
    }
    var n = hist.length, ticks = Math.min(5, n);
    for (var j = 0; j < ticks; j++) {
      var idx = Math.round((n - 1) * j / (ticks - 1));
      svg += '<text x="' + x(idx) + '" y="' + (H - 8) + '" text-anchor="' + (j === 0 ? "start" : j === ticks - 1 ? "end" : "middle") + '" font-size="12" fill="var(--mut)">' + esc(hist[idx].t) + "</text>";
    }
    series.slice().reverse().forEach(function (s) {
      var pts = hist.map(function (p, i) { return x(i).toFixed(1) + "," + y(p[s.k]).toFixed(1); }).join(" ");
      svg += '<polyline fill="none" stroke="' + s.c + '" stroke-width="2"' + (s.dash ? ' stroke-dasharray="5 4"' : "") + ' points="' + pts + '"/>';
    });
    $("chart").innerHTML = svg + "</svg>";
  }

  function load() {
    fetch("data.json?t=" + Date.now(), {cache: "no-store"})
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { data = j; render(); })
      .catch(function () { if (!data) $("updated").textContent = "Could not load data yet. Retrying every minute."; });
  }
  window.addEventListener("resize", function () { if (data) chart(data.history); });
  load();
  setInterval(load, 60000);
  setInterval(function () { if (data) render(); }, 30000);
})();
