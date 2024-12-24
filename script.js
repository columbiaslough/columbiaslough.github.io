let pointsData, linesData, polygonsData;
let currentLanguage = 'en';

document.getElementById("settings-button").addEventListener("click", function(event) {
    event.stopPropagation();
    const controlPanel = document.getElementById('control-panel');
    controlPanel.classList.toggle('open');
});

document.getElementById("close-button").addEventListener("click", function() {
    const controlPanel = document.getElementById('control-panel');
    controlPanel.classList.remove('open');
});

document.getElementById("pdf-button").addEventListener("click", function(event) {
    event.stopPropagation();
    document.getElementById('pdf-modal').style.display = "flex";
});

document.getElementById("close-pdf").addEventListener("click", function() {
    document.getElementById('pdf-modal').style.display = "none";
});

document.addEventListener("click", function(event) {
    const pdfModal = document.getElementById('pdf-modal');
    const controlPanel = document.getElementById('control-panel');

    if (pdfModal.style.display === "flex" && !pdfModal.contains(event.target) && event.target.id !== "pdf-button") {
        pdfModal.style.display = "none";
    }
    if (controlPanel.classList.contains('open') && !controlPanel.contains(event.target) && event.target.id !== "settings-button") {
        controlPanel.classList.remove('open');
    }
});

document.getElementById("reset-filters-button").addEventListener("click", function() {
    document.querySelectorAll('#filter-selector input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    map.setFilter('poi-circles', null);
    map.setFilter('poi-labels', null);
});

document.querySelectorAll('#basemap-selector input[name="basemap"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const basemapValue = e.target.value;
        let style;

        switch(basemapValue) {
            case 'satellite':
                style = 'mapbox://styles/mapbox/satellite-streets-v11';
                break;
            case 'streetmap':
                style= 'mapbox://styles/mapbox/navigation-day-v1';
                break;
            default:
                style='mapbox://styles/mapbox/satellite-streets-v11';
        }

        if (map.getSource('poi')) {
            map.removeLayer('poi-circles');
            map.removeLayer('poi-labels');
            map.removeSource('poi');
        }

        if (map.getSource('polygons')) {
            map.removeLayer('polygons-layer');
            map.removeSource('polygons');
        }

        if (map.getSource('lines')) {
            map.removeLayer('lines-layer');
            map.removeSource('lines');
        }

        if (map.getSource('points')) {
            map.removeLayer('points-layer');
            map.removeSource('points');
        }
        
        map.setStyle(style);

        map.on('style.load', function() {
            if (poi) {
                addPOI(poi);
            }
            if (polygonsData) {
                loadAdditionalFeatures();
            }
        });

        document.querySelectorAll('#filter-selector input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    
        map.setFilter('poi-circles', null);
        map.setFilter('poi-labels', null);
    });
});

document.querySelectorAll('#filter-selector input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        const selectedTags = Array.from(
            document.querySelectorAll('#filter-selector input[type="checkbox"]:checked')
        ).map(cb => cb.value);

        if (selectedTags.length === 0) {
            map.setFilter('poi-circles', null);
            map.setFilter('poi-labels', null);
            return;
        }

        const filter = [
            'all', 
            ...selectedTags.map(tag => ['in', tag, ['get', 'tags']])
        ];

        map.setFilter('poi-circles', filter);
        map.setFilter('poi-labels', filter);
    }); 
});

function initializeMap() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiY29sdW1iaWFzbG91Z2giLCJhIjoiY201MWFrbTBmMHN1aTJwcHd1dHloMGs4YyJ9.kQj7ux3XSeQiOBwxzM5B9g';
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/satellite-streets-v11',
        bounds: [[-122.9, 45.53], [-122.3, 45.65]]
    });

    map.setBearing(16);

    map.on('load', function() {

        fetch('resources/poi.geojson')
            .then(response => response.json())
            .then(data => {
                poi = data;
                addPOI(poi);
            })
            .catch(error => console.error('Error loading poi data:', error));
            
        loadAdditionalFeatures();
        });
}

function prepProperties(data) {
    data.features.forEach(feature => {
        if (!feature.properties) {
            feature.properties = {};
        }
        feature.properties.id = feature.id;
    });
    return data;
}

function loadAdditionalFeatures() {
    Promise.all([
        fetch('resources/polygons.geojson').then(response => response.json()),
        fetch('resources/lines.geojson').then(response => response.json()),
        fetch('resources/points.geojson').then(response => response.json())
    ])
    .then(([polygons, lines, points]) => {
        polygonsData = polygons;
        linesData = lines;
        pointsData = points;

        map.addSource('polygons', {
            type: 'geojson',
            data: polygonsData
        });
        map.addLayer({
            id: 'polygons-layer',
            type: 'fill',
            source: 'polygons',
            paint: {
                'fill-color': '#33ff99',
                'fill-opacity': 0.3,
                'fill-outline-color': '#d7f531'
            },
            layout: {
                'visibility': 'none'
            },
            minzoom: 13.5
        });

        map.addSource('lines', {
            type: 'geojson',
            data: linesData
        });
        map.addLayer({
            id: 'lines-layer',
            type: 'line',
            source: 'lines',
            paint: {
                'line-color': '#ff5773',
                'line-width': 2
            },
            layout: {
                'visibility': 'none'
            },
            minzoom: 13.5
        });
                
        const icons = ['restrooms', 'parking'];
        return Promise.all(
            icons.map(icon => 
                new Promise((resolve, reject) => {
                    map.loadImage(`resources/icons/${icon}.png`, (error, image) => {
                        if (error) reject(error);
                        if (!map.hasImage(icon)) {
                            map.addImage(icon, image);
                        }
                        resolve();
                    });
                })
            )
        ).then(() => {
            map.addSource('points', {
                type: 'geojson',
                data: pointsData
            });
            map.addLayer({
                id: 'points-layer',
                type: 'symbol',
                source: 'points',
                layout: {
                    'icon-image': ['get', 'type'],
                    'icon-size': 0.15,
                    'visibility': 'none'
                },
                minzoom: 13.5
            });
        });
    })
    .catch(error => console.error('Error loading features:', error));
}

function addPOI(data) {
    const processedData = prepProperties(data);
    
    map.addSource('poi', {
        type: 'geojson',
        data: processedData
    });

    map.addLayer({
        id: 'poi-circles',
        type: 'circle',
        source: 'poi',
        paint: {
            'circle-radius': 9,
            'circle-color': '#C55736',
            'circle-opacity': 1
        }
    });

    map.addLayer({
        id: 'poi-labels',
        type: 'symbol',
        source: 'poi',
        layout: {
            'text-field': ['get', 'id'],
            'text-size': 10,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'center'
        },
        paint: {
            'text-color': 'white'
        }
    });

    function createPopup(e, lang) {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const [longitude, latitude] = coordinates;
        const properties = e.features[0].properties;

        const name = properties[`name_${lang}`] || 'N/A';
        const location = properties[`location_${lang}`] || 'N/A';
        const content = properties[`contents_${lang}`] || 'N/A';

        const tags = (properties.tags || '').split(',').map(tag => tag.trim());
        const iconsHtml = tags.map(tag => `
            <div class="icon-container" title="${tag}">
                <img src="resources/icons/${tag}.png" alt="${tag}" class="icon-image">
            </div>
        `).join('');

        const popupContent = `
            <div class="popup-content">
                <div class="popup-top">
                    <div class="popup-title"
                        <b>${name}</b><br>
                        <em>${location}</em><br>
                    </div>
                    <div class="popup-icons">
                        ${iconsHtml}
                    </div>
                </div>
                <div class="popup-middle">
                    ${content}
                </div>  
                <div class="popup-bottom">
                    <div class="icon-container" id="google-link" title="Open in Google Maps">
                        <a href="https://maps.google.com/?q=${latitude},${longitude}" target="_blank"><img src="https://www.vectorlogo.zone/logos/google_maps/google_maps-icon.svg" class="icon-image"</a>
                    </div>
                    <div class="icon-container" id="bing-link" title="Open in Bing Maps">
                        <a href="https://bing.com/maps/default.aspx?cp=${latitude}~${longitude}&lvl=15" target="_blank"><img src="https://download.logo.wine/logo/Bing_Maps_Platform/Bing_Maps_Platform-Logo.wine.png" class="icon-image"</a>
                    </div>
                    <div class="icon-container" id="apple-link" title="Open in Apple Maps">
                        <a href="http://maps.apple.com/?q=${latitude},${longitude}" target="_blank"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQk4kU3uCXeJ2uIbJL0bZQbm1KNRjnI7vW3Ww&s" class="icon-image"</a>
                    </div>
            </div>
        `;

        new mapboxgl.Popup({ offset: 25})
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map)
    }

    map.on('click', 'poi-circles', (e) => {
        const clickedName = e.features[0].properties['name_en'];
        createPopup(e, currentLanguage);

        const coordinates = e.features[0].geometry.coordinates.slice();
        const title = e.features[0].properties[`name_${currentLanguage}`];

        map.flyTo({
            center: coordinates,
            zoom: 14,
            speed: 1,
            curve: 1
        });

        function filterAndShowLayer(sourceId, layerId, data, property) {
            const matchingFeatures = data.features.filter(
                feature => feature.properties[property] === clickedName
            );

            if (matchingFeatures.length > 0) {
                const filteredData = {
                    type: 'FeatureCollection',
                    features: matchingFeatures
                };
                map.getSource(sourceId).setData(filteredData);
                map.setLayoutProperty(layerId, 'visibility', 'visible');
            } else {
                map.setLayoutProperty(layerId, 'visibility', 'none');
            }
        }

        if (polygonsData) filterAndShowLayer('polygons', 'polygons-layer', polygonsData, 'feature');
        if (linesData) filterAndShowLayer('lines', 'lines-layer', linesData, 'feature');
        if (pointsData) filterAndShowLayer('points', 'points-layer', pointsData, 'feature');
    });
}

document.querySelectorAll('#language-selector input[name="language"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const pdfIframe = document.getElementById("pdf-iframe");
        const fullscreenButton = document.getElementById("full-screen-link");
        
        currentLanguage = e.target.value;
        console.log(`Language set to: ${currentLanguage}`);
        pdfIframe.src = `resources/NatureInTheCity_FINAL_${currentLanguage}.pdf`;
        fullscreenButton.href = `resources/NatureInTheCity_FINAL_${currentLanguage}.pdf`;
    });
}); 

window.onload = function() {
    initializeMap();
    map.addControl(new mapboxgl.NavigationControl());
}

document.getElementById("home-button").addEventListener("click", function() {
    map.fitBounds([[-122.9, 45.53], [-122.3, 45.65]], {bearing: 16});
});

