var map = tomtom.L.map('map', {
    key: '<your-api-key-goes-here>',
    center: [52.37187, 4.89218],
    basePath: '/sdk',
    source: 'vector',
    styleUrlMapping: {
        main: {
            basic: '/sdk/styles/mono.json',
            labels: '/sdk/styles/labels_main.json'
        }
    },
    zoom: 12
});

var MILLIS_IN_SECOND = 1000;
var DELIVERY_TIME_IN_MINUTES = 15;
var MIN_SLIDER_RANGE = 480;
var MAX_SLIDER_RANGE = 1320;
var reachableRangeBudgetTimeInSeconds = 60 * DELIVERY_TIME_IN_MINUTES;
var pizzaPrefixId = 'pizza-';
var polygonLayers = [];
var pizzaMarkers = [];
var clientMarker;
var deliveryTimeSlider;

function setDeliveryTimeSliderValue() {
    var currentDate = new Date();
    var currentTimeInMinutesWithDeliveryTime = (currentDate.getHours() * 60) + currentDate.getMinutes() + DELIVERY_TIME_IN_MINUTES;
    if (deliveryTimeSlider.getValue() < currentTimeInMinutesWithDeliveryTime) {
        if (currentTimeInMinutesWithDeliveryTime < MIN_SLIDER_RANGE) {
            deliveryTimeSlider.setValue(MIN_SLIDER_RANGE);
        }
        else if (currentTimeInMinutesWithDeliveryTime > MAX_SLIDER_RANGE) {
            deliveryTimeSlider.setValue(MAX_SLIDER_RANGE);
        } else {
            var roundedCurrentTime = currentTimeInMinutesWithDeliveryTime % 15 === 0 ? currentTimeInMinutesWithDeliveryTime : Math.ceil(currentTimeInMinutesWithDeliveryTime / 15) * 15;
            deliveryTimeSlider.setValue(roundedCurrentTime);
        }
    }
}

function setDeliveryTimeSpanValue() {
    var deliveryTimeSpan = document.getElementById('delivery-time');
    if (deliveryTimeSlider.isEnabled()) {
        deliveryTimeSpan.innerText = convertSliderValueToTimeString(deliveryTimeSlider.getValue());
    } else {
        deliveryTimeSpan.innerText = '--:--';
    }
}

function toggleDelayedDelivery() {
    deliveryTimeSlider.toggle();
    setDeliveryTimeSliderValue();
    setDeliveryTimeSpanValue();
}

function isDeliveryDelayed() {
    return deliveryTimeSlider.isEnabled();
}

function createMarker(geoJsonPoint) {
    var coordinates = geoJsonPoint.geometry.coordinates.reverse();
    var marker = tomtom.L.marker(coordinates, {
        icon: tomtom.L.icon({
            iconUrl: geoJsonPoint.properties.iconUrl,
            iconSize: [60, 60],
            iconAnchor: [30, 30],
            popupAnchor: [0, -30]
        }),
        draggable: true
    });
    marker.on('dragend', function () {
        if (polygonLayers.length > 0) {
            displayReachableRangePolygons();
        }
    });
    pizzaMarkers.push(marker);
    return marker;
}

function displayPizzaMarkers() {
    tomtom.L.geoJSON(geojson, {
        pointToLayer: createMarker
    }).addTo(map);
}

function constructRangeBatchRequest() {
    var queries = [];

    pizzaMarkers.forEach(function (marker) {
        var query = {
            origin: [marker.getLatLng().lat, marker.getLatLng().lng],
            timeBudgetInSec: reachableRangeBudgetTimeInSeconds
        };
        if (isDeliveryDelayed()) {
            var departureDeliveryDate = getDepartureDeliveryDate();
            if (departureDeliveryDate > new Date()) {
                query.departAt = departureDeliveryDate;
            }
        }
        queries.push(query);
    });
    return queries;
}

function clearPolygonLayers() {
    polygonLayers.forEach(function (layer) {
        map.removeLayer(layer);
    })
}

function displayMarkerPolygons() {
    return function (polygons) {
        polygons.forEach(function (rangeData, index) {
            if (pizzaMarkers[index]) {
                addPolygonToMap(rangeData, pizzaMarkers[index].feature.properties.polygonColor)
            }
        });
    };
}

function addPolygonToMap(rangeData, polygonColor) {
    var polygon = L.geoJson(rangeData, {
        style: createMarkerPolygonStyle(polygonColor)
    }).addTo(map);
    polygonLayers.push(polygon);
}

function createMarkerPolygonStyle(color) {
    return {
        color: color,
        opacity: 0,
        fillOpacity: 0.68
    };
}

function displayReachableRangePolygons() {
    clearPolygonLayers();
    tomtom.reachableRange(constructRangeBatchRequest())
        .go()
        .then(displayMarkerPolygons());

    calculateTravelTime();
}

function toggleTrafficFlowLayer() {
    var flowLayer = tomtom.L.MapUtils.findLayersByName('trafficFlow', map)[0];
    if (!flowLayer) {
        map.addLayer(new L.TomTomTrafficFlowLayer({source: 'vector'}));
    } else {
        map.removeLayer(flowLayer);
    }
}

function showClientMarkerOnTheMap(result) {
    document.getElementById('calculate-range').disabled = false;
    if (clientMarker) {
        map.removeLayer(clientMarker);
    }
    clientMarker = tomtom.L.marker(result.data.position, {
        icon: tomtom.L.icon({
            iconUrl: 'img/pizza_marker-1.png',
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        })
    }).addTo(map);
    if (polygonLayers.length > 0) {
        displayReachableRangePolygons();
    }
}

function initControlMenu() {
    var searchBoxInstance = tomtom.searchBox({
        collapsible: false,
        searchOnDragEnd: 'never'
    }).addTo(map);
    document.getElementById('search-panel').appendChild(searchBoxInstance.getContainer());
    deliveryTimeSlider = new Slider('#slider-input', {
        min: MIN_SLIDER_RANGE,
        max: MAX_SLIDER_RANGE,
        value: MIN_SLIDER_RANGE,
        step: 15,
        tooltip: 'hide',
        enabled: false,
        rangeHighlights: [
            {start: 510, end: 810, class: 'medium-traffic'},
            {start: 540, end: 705, class: 'high-traffic'}
        ]
    });
    deliveryTimeSlider.on('change', function (event) {
        document.getElementById('delivery-time').innerText = convertSliderValueToTimeString(event.newValue);
    }, false);
    deliveryTimeSlider.on('slideStop', function () {
        setDeliveryTimeSliderValue();
        setDeliveryTimeSpanValue();
    });
    document.getElementById('calculate-range').addEventListener('click', displayReachableRangePolygons);
    document.getElementById('delivery-toggle').addEventListener('change', toggleDelayedDelivery);
    document.getElementById('traffic-toggle').addEventListener('change', toggleTrafficFlowLayer);
    searchBoxInstance.on(searchBoxInstance.Events.ResultClicked, showClientMarkerOnTheMap);
}

function convertSliderValueToTimeString(sliderValue) {
    var hours = Math.floor(sliderValue / 60);
    var minutes = sliderValue % 60;
    if (hours < 10) {
        hours = '0' + hours;
    }
    if (minutes < 10) {
        minutes = '0' + minutes;
    }
    return hours + ':' + minutes;
}

function getDeliveryDateTime() {
    var timeParts = document.getElementById('delivery-time').innerText.split(':');
    var chosenDeliveryDate = new Date();
    chosenDeliveryDate.setHours(parseInt(timeParts[0]));
    chosenDeliveryDate.setMinutes(parseInt(timeParts[1]));
    return chosenDeliveryDate;
}

function getDepartureDeliveryDate() {
    return new Date(getDeliveryDateTime().getTime() - reachableRangeBudgetTimeInSeconds * MILLIS_IN_SECOND);
}

function constructBatchRequest() {
    var queries = [];

    pizzaMarkers.forEach(function (marker) {
        var query = {
            locations: [marker.getLatLng(), clientMarker.getLatLng()],
            computeTravelTimeFor: 'all'
        };
        if (isDeliveryDelayed()) {
            var departureDeliveryDate = getDepartureDeliveryDate();
            if (departureDeliveryDate > new Date()) {
                query.departAt = departureDeliveryDate;
            }
        }
        queries.push(query);
    });
    return queries;
}

function displayBatchRoutingResults(resultData) {
    var indexShortestTime;
    var shortestTime;
    resultData.forEach(function (routeData, index) {
        var pizzaElement = document.getElementById(pizzaPrefixId + (index + 1));
        pizzaElement.classList.remove('active');
        var travelTimesElements = pizzaElement.getElementsByClassName('travel-time-minutes');
        if (travelTimesElements.length > 0) {
            pizzaElement.removeChild(travelTimesElements[0]);
        }

        if (routeData && !routeData.error) {
            var travelTime = routeData.features[0].properties.summary.travelTimeInSeconds;
            if (!shortestTime || shortestTime > travelTime) {
                indexShortestTime = index;
                shortestTime = travelTime;
            }
            var travelTimeSpan = document.createElement('span');
            travelTimeSpan.innerHTML = Math.ceil(travelTime / 60).toString() + ' mins';
            travelTimeSpan.classList.add('travel-time-minutes');
            pizzaElement.appendChild(travelTimeSpan);
        }
    });
    if (typeof indexShortestTime !== 'undefined' || indexShortestTime !== null) {
        document.getElementById(pizzaPrefixId + (indexShortestTime + 1)).classList.add('active');
    }
    map.closePopup();
    createAndBindPopups();
}

function createAndBindPopups() {
    pizzaMarkers.forEach(function (marker, index) {
        var pizzaMenuDiv = document.getElementById(pizzaPrefixId + (index + 1));
        var pizzaSpans = pizzaMenuDiv.getElementsByTagName('span');
        var pizzaString = '<span><b>' + pizzaSpans[0].textContent + '</b>';
        if (pizzaSpans.length > 1) {
            pizzaString += '<br>' + pizzaSpans[1].textContent;
        }
        pizzaString += '</span>';

        var customPopup = '<div class="pizza-balloon">' + pizzaString +
            '<img src="img/pizza_oven_illustration.png" alt="pizza oven"/></div>';
        marker.bindPopup(customPopup).addTo(map);
    });
}


function calculateTravelTime() {
    if (clientMarker && pizzaMarkers.length > 0) {
        tomtom.routing((constructBatchRequest()))
            .go()
            .then(displayBatchRoutingResults)
    }
}

initControlMenu();
displayPizzaMarkers();
createAndBindPopups();