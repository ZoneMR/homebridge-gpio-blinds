# homebridge-gpio-blinds

Control Somfy/Velux/etc blinds via remote wired up to the GPIO pins.

## Configuration

Add the accessory in `config.json` in your home directory inside `.homebridge`.

```js
   {
     "accessory": "GPIO-Blinds",
     "name": "Bedroom Blinds",
     "up_pin": 22,
     "down_pin": 16,
     "stop_pin": 18,
     "motion_time": 13000, *** Estimated in ms to fully open/close
     "motion_lag": 750 *** Typical lag before blinds start moving
    }
```

## Note
This plugin based on [homebridge-noolite-http-blinds].

Feel free to contribute to make this a better plugin!

## Hardware

In my case, I connected the RPI GPIO pins directly to the switch terminals on my Somfy / Velux blind remotes.

![Hardware Example](https://dl.dropboxusercontent.com/u/2190056/IMG_1415.jpg)
