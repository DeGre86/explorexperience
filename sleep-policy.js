/* Shared browser/Node policy; use the rider phone zone, never the visitor zone. */
(function (root) {
  'use strict';
  function resolve(activity, now = new Date()) {
    const manual = activity?.sleep_mode === 'manual';
    let zone = typeof activity?.time_zone === 'string' ? activity.time_zone : 'Europe/Berlin';
    let hour;
    try { hour = Number(new Intl.DateTimeFormat('en-GB', {timeZone:zone, hour:'2-digit', hourCycle:'h23'}).format(now)); }
    catch { zone = 'Europe/Berlin'; hour = Number(new Intl.DateTimeFormat('en-GB', {timeZone:zone, hour:'2-digit', hourCycle:'h23'}).format(now)); }
    return {sleeping:manual || hour >= 22 || hour < 6, manual, timeZone:zone};
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {resolve};
  else root.SleepPolicy = {resolve};
})(typeof globalThis !== 'undefined' ? globalThis : this);
