import onoff from 'onoff'

class ButtonsController {

  constructor(delegate) {

    this.delegate = delegate

    this.startButton = new onoff.Gpio(17, 'in', 'both');
    this.emergencyButton = new onoff.Gpio(27, 'in', 'both');

    this.isStartButtonDepressed = true
    this.isEmergencyButtonDepressed = !this.emergencyButton.readSync()

    this.startButtonTimer = 0
    this.emergencyButtonTimer = 0

    let that = this

    setInterval(function() {

      /*that.isEmergencyButtonDepressed = !that.emergencyButton.readSync()
      clearTimeout(that.emergencyButtonTimer)
      that.emergencyButtonTimer = setTimeout(that.delegate.onCancelButton, 500)*/

      /*if (that.emergencyButton.readSync() === 0) {
        console.log('[BUTTOOOON EMERGENCY PRESSED]');

        that.isEmergencyButtonDepressed = true;
        that.delegate.onCancelButton;

        that.emergencyButtonTimer = setTimeout(that.delegate.onCancelButton, 500)
      } else {
        that.isEmergencyButtonDepressed = false;
        that.delegate.onCancelButton;

        that.emergencyButtonTimer = setTimeout(that.delegate.onCancelButton, 500)
      }*/

      if (that.emergencyButton.readSync() === 1) {
        that.isEmergencyButtonDepressed = false;
        that.delegate.onCancelButton;
      } else {
        that.isEmergencyButtonDepressed = true;
        that.delegate.onCancelButton;
      }
    }, 1000);

    this.startButton.watch(function(err, value) {

      if (that.startButton.readSync() === 1) {
        if (that.isEmergencyButtonDepressed) {
          console.log("Emergency button is engaged. Not starting press.");
          return
        }

        that.isStartButtonDepressed = !that.startButton.readSync()

        return;
      }

      console.log("Start button press detected: " + that.startButton.readSync())

      if (that.isEmergencyButtonDepressed) {
        console.log("Emergency button is engaged. Not starting press.");
        return
      }

      that.isStartButtonDepressed = !that.startButton.readSync()

      clearTimeout(that.startButtonTimer)

      that.startButtonTimer = setTimeout(that.delegate.onStartButton, 1000)
    })

    this.emergencyButton.watch(function(err, value) {

      if (that.emergencyButton.readSync() === 1) {
        that.isEmergencyButtonDepressed = !that.emergencyButton.readSync()
        return;
      }

      console.log("Emergency button press detected: " + that.emergencyButton.readSync())

      that.isEmergencyButtonDepressed = !that.emergencyButton.readSync()

      clearTimeout(that.emergencyButtonTimer)

      that.emergencyButtonTimer = setTimeout(that.delegate.onCancelButton, 500)
    });
  }
}

module.exports = ButtonsController