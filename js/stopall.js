/* wubflipz — global emergency stop
 * Hard-kills every known audio subsystem after a 10ms output ramp-down.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);

  function emergencyStopAll() {
    window.dispatchEvent(new CustomEvent("wf:emergency-stop"));
    if (WF.Engine && WF.Engine.emergencyStop) WF.Engine.emergencyStop();
    if (WF.Player && WF.Player.emergencyStop) WF.Player.emergencyStop();
    if (WF.Lanes && WF.Lanes.emergencyStop) WF.Lanes.emergencyStop();
    if (WF.Stems && WF.Stems.emergencyStop) WF.Stems.emergencyStop();
    if (WF.Sequencer && WF.Sequencer.emergencyStop) WF.Sequencer.emergencyStop();
    const status = $("status");
    if (status) status.textContent = "Emergency stopped";
  }

  WF.emergencyStopAll = emergencyStopAll;
  const btn = $("panicStop");
  if (btn) btn.addEventListener("click", emergencyStopAll);
})();
