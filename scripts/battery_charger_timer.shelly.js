print("Hi, its the Shelly power stopper!");

/*
This script will monitor the pwer usage of a Shelly Plug and turn it off
if the power usage remains below a defined threshold (10 Watt) for a set period
(10 minutes).

The LED on the plug will indicate the timer status:
- When the power is below threshold, the LED will gradually change from Blue to Green over 10 minutes.
- If the power goes back above the threshold, the LED resets to Blue and the timer is canceled.

Configuration parameters can be adjusted in the CONFIG object.
*/

let CONFIG = {
  powerThreshold: 5,       // Power in Watts
  timeThreshold: 10 * 60,  // 10 minutes converted to seconds
  pollingInterval: 3,      // Check every 3 seconds
  switchId: 0              // ID for the plug's relay
};

let timerHandle = null;
let timerLED = 0;
let ledIncrement = 100 / (CONFIG.timeThreshold / CONFIG.pollingInterval);

/**
 * Sets the LED behavior for the plug.
 * @param {Array} onRGB - [R, G, B] values (0-100) for the 'On' state.
 * @param {Array} offRGB - [R, G, B] values (0-100) for the 'Off' state.
 */
function updateLEDs(onRGB, offRGB) 
{
  Shelly.call("PLUGS_UI.SetConfig", {
    id: CONFIG.switchId, 
    config: {
      leds: {
        mode: "switch", // Must be in 'switch' mode to set custom colors
        colors: {
          "switch:0": {
            "on": { "rgb": onRGB, "brightness": 100 },
            "off": { "rgb": offRGB, "brightness": 100 }
          }
        }
      }
    }
  } );
}

/** * Sets the LED color to specified RGB values.
 * @param {number} r - Red component (0-100).
 * @param {number} g - Green component (0-100).
 * @param {number} b - Blue component (0-100).
 */
function setLEDColor(r, g, b)
{
  Shelly.call("PLUGS_UI.SetConfig", { 
    id: CONFIG.switchId, 
    config: {
      "leds": {
        mode: "switch", // Must be in 'switch' mode to set custom colors
        colors: {
          "switch:0": {
            "on": {"rgb": [r, g, b], "brightness": 100}
          }
        }
      }
    }
  } );
}

/** Monitors power usage and manages the timer and LED effects.
 */
function checkPower() {
  Shelly.call("Switch.GetStatus", { id: CONFIG.switchId }, function (status) {
    if (status.output === false) {
      // If plug is already off, clear any active timers
      timerLED=0;
      if (timerHandle) {
        print("plug is already off, clear active timers");
        Timer.clear(timerHandle);
        timerHandle = null;
      }
      return;
    }

    // Check current power usage (apower)
    if (status.apower < CONFIG.powerThreshold) {
      timerLED = (timerLED+ledIncrement < 100) ? timerLED+ledIncrement : 100;
      setLEDColor(0, Math.round(timerLED), 100-Math.round(timerLED)); // Green timer effect
      // If power is low and no timer is running, start the countdown
      if (!timerHandle) {
        print("Power below threshold. Starting 10-minute countdown...");
        timerHandle = Timer.set(CONFIG.timeThreshold * 1000, false, function() {
          print("Power remained low for 10 minutes. Turning off.");
          Shelly.call("Switch.Set", { id: CONFIG.switchId, on: false });
          timerHandle = null;
        });
      }
    } else {
      // If power goes back above threshold, reset/cancel the timer
      timerLED = 0;
      if (timerHandle) {
        print("Power recovered. Resetting timer.");
        setLEDColor(0, 0, 100); // Reset to Blue
        Timer.clear(timerHandle);
        timerHandle = null;
      }
    }
  });
}

// 1. Initialize Device:  setup: On=Blue, Off=Red
updateLEDs([0, 0, 100], [100, 0, 0]);

// 2. Start the monitoring loop (every 3 seconds)
Timer.set(CONFIG.pollingInterval * 1000, true, checkPower);

