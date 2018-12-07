# TomTom JavaScript SDK 4.35.6

## Documentation

Please refer to the [Maps SDK section](https://developer.tomtom.com/maps-sdk) in the TomTom's Developer Portal for detailed documentation with examples.
Also, the latest version of this SDK can be found there.

## Package content

The package contains the following files:

- `tomtom.min.js` - Library in [UMD format](https://github.com/umdjs/umd). The code is minified and does not need any external dependencies.
- `tomtom.min.js.map` - Source map for the SDK built file.
- `map.css` - Cascading Style Sheet needed by the library. It is necessary to load it in the HTML file next with tomtom.min.js.
- `LICENSE.txt` - License file.
- `README.md` - This file.
- `images/` - A few images needed by the library and fallback PNGs for older browsers. The icons used by the SDK are vector graphics which are provided embedded in `map.css`.
- `glyphs/` - Glyphs files used by the vector tile layer.
- `sprites/` - Sprite images used by the vector tile layer to display the shields over the map.
- `mapbox-gl-js/`* - Version of the mapbox-gl-js library that is proved to be compatible with the class [L.TomTomVectorLayer](https://developer.tomtom.com/maps-sdk/maps-sdk-documentation#L.TomTomVectorLayer). **Only available in the version without vector maps support built into the SDK**.

## Getting started

Please check the examples for better understanding of the common use cases. The minimal *HTML* page allowing to display
the TomTom map could look like this:

```html
<html>
    <head>
        <link rel="stylesheet" type="text/css" href="map.css"/>
        <script src="tomtom.min.js"></script>
    </head>
    <body style="width: 100%; height: 100%; margin: 0; padding: 0;">
        <div id="map" style="width: 100%; height: 100%;"></div>
        <script>
            tomtom.key("${api.key}");
            var map = tomtom.map("map");
        </script>
    </body>
</html>
```

Please note that you need to have a valid **api key** which can be obtained at [TomTom's Developer Portal](http://developer.tomtom.com).

## License

© 1992 – 2018 TomTom
The library is licensed under Apache License Version 2.0, check LICENSE.txt for details.
