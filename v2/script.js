let pointsData, linesData, polygonsData;
let currentLanguage = 'en';
let currentImageIndex = 0;
let labelsVisible = false;
let poi;

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

document.getElementById("labels-button").addEventListener("click", function() {
    labelsVisible = !labelsVisible;
    if (map.getLayer('poi-point-labels')) {
        map.setLayoutProperty('poi-point-labels', 'visibility', labelsVisible ? 'visible' : 'none');
    }
    this.style.backgroundColor = labelsVisible ? '#1592b5' : '#aaadca';
});

document.getElementById("sidebar-button").addEventListener("click", function(event) {
    event.stopPropagation();
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
});

document.getElementById("close-sidebar").addEventListener("click", function() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('open');
});

document.addEventListener("click", function(event) {
    const pdfModal = document.getElementById('pdf-modal');
    const controlPanel = document.getElementById('control-panel');
    const sidebar = document.getElementById('sidebar');

    if (pdfModal.style.display === "flex" && !pdfModal.contains(event.target) && event.target.id !== "pdf-button") {
        pdfModal.style.display = "none";
    }
    if (controlPanel.classList.contains('open') && !controlPanel.contains(event.target) && event.target.id !== "settings-button") {
        controlPanel.classList.remove('open');
    }
    if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && event.target.id !== "sidebar-button") {
        sidebar.classList.remove('open');
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
            if (map.getLayer('poi-point-labels')) {
                map.removeLayer('poi-point-labels');
            }
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
        bounds: [[-122.8, 45.53], [-122.45, 45.65]]
    });

    map.setBearing(16);

    map.on('load', function() {

        fetch('../resources/poi.geojson')
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
        fetch('../resources/polygons.geojson').then(response => response.json()),
        fetch('../resources/lines.geojson').then(response => response.json()),
        fetch('../resources/points.geojson').then(response => response.json()),
        fetch('../resources/subpoints.geojson').then(response => response.json())
    ])
    .then(([polygons, lines, points, subpoints]) => {
        polygonsData = polygons;
        linesData = lines;
        pointsData = points;
        subpointsData = subpoints;

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
            minzoom: 13
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
            minzoom: 13
        });

        map.loadImage('../resources/icons/square.png', (error, image) => {
            if (error) throw error;
            map.addImage('square', image)
        });

        map.addSource('subpoints', {
            type: 'geojson',
            data: subpoints
        });
    
        map.addLayer({
            id: 'subpoints',
            type: 'symbol',
            source: 'subpoints',
            layout: {
                'icon-image': 'square',
                'icon-rotate': 45,
                'icon-size': 0.1
            },
            minzoom: 13
        });

        map.addLayer({
            id: 'subponts-labels',
            type: 'symbol',
            source: 'subpoints',
            layout: {
                'text-field': ['get', 'title_en'],
                'text-size': 9,
                'text-font': ['Roboto Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-anchor': 'right',
                'text-offset': [1.5, -1.5],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
                'symbol-placement': 'point'
            },
            paint: {
                'text-color': 'black',
                'text-halo-color': 'white',
                'text-halo-width': 0.6
            },
            minzoom: 13
        });
                
        const icons = ['restrooms', 'parking'];
        return Promise.all(
            icons.map(icon => 
                new Promise((resolve, reject) => {
                    map.loadImage(`../resources/icons/${icon}.png`, (error, image) => {
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
                    'icon-size': 0.09,
                    'visibility': 'none'
                },
                minzoom: 13
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
            'circle-color': '#dc9c3c',
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
            'text-font': ['Roboto Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'center',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'symbol-placement': 'point'
        },
        paint: {
            'text-color': 'white',
            'text-halo-color': 'black',
            'text-halo-width': 0.6
        }
    });

    map.addLayer({
        id: 'poi-point-labels',
        type: 'symbol',
        source: 'poi',
        layout: {
            'text-field': ['get', `name_${currentLanguage}`],
            'text-size': 14,
            'text-font': ['Roboto Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'bottom-left',
            'text-offset': [0.5, -0.5],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'symbol-placement': 'point',
            'visibility': 'none'
        },
        paint: {
            'text-color': 'white',
            'text-halo-color': 'black',
            'text-halo-width': 2
        }
    });

    map.on('click', 'poi-circles', (e) => {
        const clickedName = e.features[0].properties['name_en'];
        createPopupFromFeature(e.features[0], currentLanguage);

            const coordinates = e.features[0].geometry.coordinates.slice();
        const zoomLevel = e.features[0].properties['zoom'];

        map.flyTo({
            center: coordinates,
            zoom: zoomLevel,
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

    map.on('click', 'subpoints', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const properties = e.features[0].properties;
        createSubPopup(e, currentLanguage);

        map.flyTo({
            center: coordinates,
            zoom: 15,
            speed: 1,
            curve: 1
        });
    });

    function createSubPopup(e, lang) {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const properties = e.features[0].properties;

        const subName = properties[`title_${lang}`] || '';
        const subLocation = properties[`directions_${lang}`] || '';
        const subContent = properties[`content_${lang}`] || '';

        const subPopupContent = `
            <div class="popup-content">
                <div class="popup-top">
                    <div class="popup-title">
                        <strong>${subName}</strong><br>
                        <em>${subLocation}</em><br>
                    </div>
                </div>
                <div class="popup-middle">
                    ${subContent}
                </div>        
            </div>
        `;

        const popup = new mapboxgl.Popup({ offset: -5})
            .setLngLat(coordinates)
            .setHTML(subPopupContent)
            .addTo(map);
    }

    populateSidebar(processedData);
}

function getSidebarImageElement(images, pointId, name) {
    const hasRealImages = images.length > 0 && images[0] !== "image0";
    return hasRealImages 
        ? `<img src="../resources/popup-images/${images[0]}.jpg" alt="${name}" class="point-item-image">`
        : `<div class="point-number-circle">${pointId}</div>`;
}

function getPopupImageElement(images, pointId) {
    if (images.length > 0 && images[0] !== 'image0') {
        return `<img id="current-image" src="../resources/popup-images/${images[0]}.jpg" alt="picture" class="popup-image" />`;
    } else {
        return `<img id="current-image" src="../resources/popup-images/image0.png" alt="logo" class="popup-image" />`;
    }
}

function populateSidebar(data) {
    const pointsList = document.getElementById('points-list');
    pointsList.innerHTML = '';

    data.features.forEach(feature => {
        const properties = feature.properties;
        const name = properties[`name_${currentLanguage}`] || '';
        const content = properties[`contents_${currentLanguage}`] || '';
        const images = properties.images ? properties.images.split(',') : [];
        const pointId = properties.id || '';
        
        const imageElement = getSidebarImageElement(images, pointId, name);
        
        const truncatedContent = content.length > 100 ? content.substring(0, 100) + '...' : content;
        
        const pointItem = document.createElement('div');
        pointItem.className = 'point-item';
        pointItem.innerHTML = `
            ${imageElement}
            <div class="point-item-content">
                <div class="point-item-title">${name}</div>
                <div class="point-item-description">${truncatedContent}</div>
            </div>
        `;
        
        pointItem.addEventListener('click', () => {
            const coordinates = feature.geometry.coordinates;
            const zoomLevel = properties.zoom || 14;
            
            document.getElementById('sidebar').classList.remove('open');
            
            map.flyTo({
                center: coordinates,
                zoom: zoomLevel,
                speed: 1,
                curve: 1
            });
            
            const existingPopups = document.querySelectorAll('.mapboxgl-popup');
            existingPopups.forEach(popup => popup.remove());
            
            setTimeout(() => {
                createPopupFromFeature(feature, currentLanguage);
            }, 400);
        });
        
        pointsList.appendChild(pointItem);
    });
}

document.querySelectorAll('#language-selector input[name="language"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const pdfIframe = document.getElementById("pdf-iframe");
        const fullscreenButton = document.getElementById("full-screen-link");
        
        currentLanguage = e.target.value;
        console.log(`Language set to: ${currentLanguage}`);
        pdfIframe.src = `../resources/NatureInTheCity_FINAL_${currentLanguage}.pdf`;
        fullscreenButton.href = `../resources/NatureInTheCity_FINAL_${currentLanguage}.pdf`;
        
        if (map.getLayer('poi-point-labels')) {
            map.setLayoutProperty('poi-point-labels', 'text-field', ['get', `name_${currentLanguage}`]);
        }
        
        if (poi) {
            const processedData = prepProperties(poi);
            populateSidebar(processedData);
        }
    });
}); 

function showPreviousImage(images) {
    if (!images.length) return;
    currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
    document.getElementById('current-image').src = `../resources/popup-images/${images[currentImageIndex]}.jpg`;
}

function showNextImage(images) {
    if (!images.length) return;
    currentImageIndex = (currentImageIndex + 1) % images.length;
    document.getElementById('current-image').src = `../resources/popup-images/${images[currentImageIndex]}.jpg`;
}

function openImageModal(images) {
    const modalHtml = `
        <div id="image-modal" class="modal-overlay">
            <div class="modal-content">
                <img id="modal-image" src="../resources/popup-images/${images[currentImageIndex]}.jpg" alt="Detailed view">
                <button class="carousel-button left-button" id="modal-previous-button">&#9664;</button>
                <button class="carousel-button right-button" id="modal-next-button">&#9654;</button>
            </div>
        </div>
    `;

    const modal = document.createElement('div');
    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);

    const modalOverlay = document.getElementById('image-modal');

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });

    document.getElementById('modal-previous-button').addEventListener('click', (e) => {
        e.stopPropagation(); 
        showPreviousImage(images);
        document.getElementById('modal-image').src = `../resources/popup-images/${images[currentImageIndex]}.jpg`;
    });

    document.getElementById('modal-next-button').addEventListener('click', (e) => {
        e.stopPropagation(); 
        showNextImage(images);
        document.getElementById('modal-image').src = `../resources/popup-images/${images[currentImageIndex]}.jpg`;
    });
}


window.onload = function() {
    initializeMap();
    map.addControl(new mapboxgl.NavigationControl());
}

document.getElementById("home-button").addEventListener("click", function() {
    map.fitBounds([[-122.9, 45.53], [-122.3, 45.65]], {bearing: 16});
});

function createPopupFromFeature(feature, lang) {
    const coordinates = feature.geometry.coordinates.slice();
    const [longitude, latitude] = coordinates;
    const properties = feature.properties;

    const name = properties[`name_${lang}`] || '';
    const location = properties[`location_${lang}`] || '';
    const content = properties[`contents_${lang}`] || '';
    const pointId = properties.id || '';

    const images = properties.images ? properties.images.split(',') : [];
    const hasRealImages = images.length > 0 && images[0] !== 'image0';
    const isDefaultImage = !hasRealImages;

    const imageHtml = getPopupImageElement(images, pointId);

    const tags = (properties.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
    const iconsHtml = tags.map(tag => `
            <div class="icon-container" title="${tag}">
                <img src="../resources/icons/${tag}.svg" alt="${tag}" class="icon-image">
            </div>
        `).join('');

    const popupContent = `
            <div class="popup-content">
                <div class="popup-top">
                    <div class="popup-title">
                        <strong>${name}</strong><br>
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
                    <div class="links-container">
                        <p><b>Additional information:</b></p>
                        <p class="additional-links"></p>
                        <div class="map-icons">
                            <div class="map-icon-container" title="Open in Google Maps">
                                <a href="https://maps.google.com/?q=${latitude},${longitude}" target="_blank"><img src="https://www.vectorlogo.zone/logos/google_maps/google_maps-icon.svg" class="icon-image"></a>
                            </div>
                            <div class="map-icon-container" title="Open in Apple Maps">
                                <a href="http://maps.apple.com/?q=${latitude},${longitude}" target="_blank"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQk4kU3uCXeJ2uIbJL0bZQbm1KNRjnI7vW3Ww&s" class="icon-image"></a>
                            </div>
                            <div class="map-icon-container" title="Open in Bing Maps">
                                <a href="https://bing.com/maps/default.aspx?cp=${latitude}~${longitude}&lvl=15" target="_blank"><img src="https://download.logo.wine/logo/Bing_Maps_Platform/Bing_Maps_Platform-Logo.wine.png" class="icon-image"></a>
                            </div>
                        </div>
                    </div>
                    <div class="image-carousel">
                        <div class="image-wrapper">
                            ${imageHtml}
                        </div>
                        <button class="carousel-button left-button prev-image" style="display:${hasRealImages && images.length > 1 ? 'block' : 'none'};">&#9664;</button>
                        <button class="carousel-button right-button next-image" style="display:${hasRealImages && images.length > 1 ? 'block' : 'none'};">&#9654;</button>
                    </div>
                </div>
            </div>`;

    const popup = new mapboxgl.Popup({
        offset: 10,
        anchor: 'bottom-right',
        closeOnClick: false
    })
        .setLngLat(coordinates)
        .setHTML(popupContent)
        .addTo(map);

    const root = popup.getElement();
    
    if (hasRealImages) {
        root.querySelector('.prev-image')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            showPreviousImage(images);
        });
        root.querySelector('.next-image')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            showNextImage(images);
        });
    }

    const currentImage = root.querySelector('#current-image');
    if (currentImage && hasRealImages) {
        currentImage.addEventListener('click', (ev) => {
            ev.stopPropagation();
            openImageModal(images);
        });
    }

    const links = properties.links || '';
    const additionalLinksElement = root.querySelector('.additional-links');
    const linksContainer = root.querySelector('.links-container');
    const mapIconsContainer = root.querySelector('.map-icons');
    const imageCarouselContainer = root.querySelector('.image-carousel');
    if (links) {
        if (additionalLinksElement) additionalLinksElement.innerHTML = links;
        imageCarouselContainer.style.flex = '3';
        linksContainer.style.flex = '2';
        mapIconsContainer.style.display = 'flex';
    } else {
        if (additionalLinksElement) additionalLinksElement.style.display = 'none';
        imageCarouselContainer.style.flex = '6';
        linksContainer.style.flex = '1';
        mapIconsContainer.style.display = 'block';
    }

    return popup;
}