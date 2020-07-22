var apiKey = 'YOUR_API_KEY';
var centerCoords = [4.89218, 52.37187];
var map = tt.map({
    key: apiKey,
    container: 'map',
    center: centerCoords,
    style: 'mono.json',
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
var searchBoxInstance;
var commonOptions = {
    key: apiKey,
    center: map.getCenter(),
    radius: 1000
};

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
    var position = geoJsonPoint.geometry.coordinates;
    const markerElement = document.createElement('div');
    markerElement.innerHTML = "<img src='" + geoJsonPoint.properties.iconUrl + "' style='width: 50px; height: 50px';>";
    marker = new tt.Marker({
        draggable: true,
        element: markerElement
    }).setLngLat(position).addTo(map);
    marker.on('dragend', function () {
        if (polygonLayers.length > 0) {
            displayReachableRangePolygons();
        }
    });
    marker.polygonColor = geoJsonPoint.properties.polygonColor;
    pizzaMarkers.push(marker);
    return marker;
}

function displayPizzaMarkers() {
    geojson.features.forEach(function (marker) {
        createMarker(marker);
    });
}

function constructRangeBatchRequest() {
    var queries = [];
    pizzaMarkers.forEach(function (marker) {
        var query = {
            origin: [marker.getLngLat().lng, marker.getLngLat().lat],
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
        map.removeLayer(layer.id);
        map.removeSource(layer.id);
    })
    polygonLayers = [];
}

function displayMarkerPolygons(polygons) {
    polygons.batchItems.forEach(function (rangeData, index) {
        if (pizzaMarkers[index]) {
            addPolygonToMap("polygon_" + index, rangeData, pizzaMarkers[index].polygonColor)
        }
    });
}

function buildStyle(id, data, color) {
    return {
        'id': id,
        'type': 'fill',
        'source': {
            'type': 'geojson',
            'data': data
        },
        'paint': {
            'fill-color': color,
            'fill-opacity': 0.68,
        },
        'layout': {}
    }
}

function addPolygonToMap(id, rangeData, polygonColor) {
    let polygonLayer = buildStyle(id, rangeData.toGeoJson(), polygonColor);
    map.addLayer(polygonLayer);
    polygonLayer.id = id;
    polygonLayers.push(polygonLayer);
}

function displayReachableRangePolygons() {
    closeAllPopups();
    clearPolygonLayers();
    tt.services.calculateReachableRange({
        batchMode: 'sync',
        key: apiKey,
        batchItems: constructRangeBatchRequest()
    })
    .then(function (polygons) {
        displayMarkerPolygons(polygons);
    });

    calculateTravelTime();
}

function toggleTrafficFlowLayer() {
    if (document.getElementById('traffic-toggle').checked) {
        map.showTrafficFlow();
    }
    else {
        map.hideTrafficFlow();
    }
}

function showClientMarkerOnTheMap(result) {
    document.getElementById('calculate-range').disabled = false;
    if (clientMarker) {
        clientMarker.remove();
    }
    const markerElement = document.createElement('div');
    markerElement.innerHTML = "<img src='img/pizza_marker-1.png' style='width: 50px; height: 50px';>";
    var position = result.data.result.position;
    clientMarker = new tt.Marker({ element: markerElement }).setLngLat([position.lng, position.lat]).addTo(map);
    if (polygonLayers.length > 0) {
        displayReachableRangePolygons();
    }
}

function updateMapCenterOption() {
    var updatedOptions = Object.assign(commonOptions, { center: map.getCenter() });

    searchBoxInstance.updateOptions({
        minNumberOfCharacters: 0,
        searchOptions: updatedOptions,
        autocompleteOptions: updatedOptions
    });
}

function initControlMenu() {
    searchBoxInstance = new tt.plugins.SearchBox(tt.services, {
        minNumberOfCharacters: 0,
        searchOptions: commonOptions,
        autocompleteOptions: commonOptions
    });
    document.getElementById('search-panel').append(searchBoxInstance.getSearchBoxHTML());
    deliveryTimeSlider = new Slider('#slider-input', {
        min: MIN_SLIDER_RANGE,
        max: MAX_SLIDER_RANGE,
        value: MIN_SLIDER_RANGE,
        step: 15,
        tooltip: 'hide',
        enabled: false,
        rangeHighlights: [
            { start: 510, end: 810, class: 'medium-traffic' },
            { start: 540, end: 705, class: 'high-traffic' }
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
    searchBoxInstance.on('tomtom.searchbox.resultselected', showClientMarkerOnTheMap);
    map.on('moveend', updateMapCenterOption);
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
            locations: [marker.getLngLat(), clientMarker.getLngLat()],
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
    resultData.batchItems.forEach(function (routeData, index) {
        const routeGeoJson = routeData.toGeoJson();
        var pizzaElement = document.getElementById(pizzaPrefixId + (index + 1));
        pizzaElement.classList.remove('active');
        var travelTimesElements = pizzaElement.getElementsByClassName('travel-time-minutes');
        if (travelTimesElements.length > 0) {
            pizzaElement.removeChild(travelTimesElements[0]);
        }

        if (routeData && !routeData.error) {
            var travelTime = routeGeoJson.features[0].properties.summary.travelTimeInSeconds;
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
    closeAllPopups();
    createAndBindPopups();
    pizzaMarkers[indexShortestTime].togglePopup();
}

function closeAllPopups() {
    pizzaMarkers.forEach(function(marker) {
        if (marker.getPopup().isOpen()) {
            marker.togglePopup();
        }
    })
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
        marker.setPopup(new tt.Popup({ offset: 35 }).setHTML(customPopup));
    });
}

function calculateTravelTime() {
    if (clientMarker && pizzaMarkers.length > 0) {
        tt.services.calculateRoute({
            batchMode: 'sync',
            key: apiKey,
            batchItems: constructBatchRequest()
        })
        .then(displayBatchRoutingResults)
    }
}

initControlMenu();
displayPizzaMarkers();
createAndBindPopups();
