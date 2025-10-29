import { db, fetchFeatures } from './firebase-config.js';
import {
    initializeMapBase,
    addPolygonsLayer,
    addLinesLayer,
    addPointsLayer,
    addPOILayer,
    getImageUrl,
    parseImages,
    hasRealImages,
    filterAndShowLayer,
    updatePOILanguage,
    getPopupImageHtml,
    getIconsHtml,
    getMapLinksHtml
} from './shared-map-functions.js';

let pointsData, linesData, polygonsData, poiData;
let currentLanguage = 'en';
let currentImageIndex = 0;
let labelsVisible = false;
let currentPopup = null;
let subpointsData;
let map;

async function loadAllData() {
    try {
        const [points, lines, polygons, poi] = await Promise.all([
            fetchFeatures('points'),
            fetchFeatures('lines'),
            fetchFeatures('polygons'),
            fetchFeatures('poi')
        ]);
        
        pointsData = points;
        linesData = lines;
        polygonsData = polygons;
        poiData = poi;

        console.log('Data loaded:', { 
            points: pointsData.features.length, 
            lines: linesData.features.length, 
            polygons: polygonsData.features.length, 
            poi: poiData.features.length 
        });

        initializeMap();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

document.getElementById("settings-button").addEventListener("click", function(event) {
    event.stopPropagation();
    const controlPanel = document.getElementById('control-panel');
    const sidebar = document.getElementById('sidebar');

    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
    controlPanel.classList.toggle('open');
});

document.getElementById("close-button").addEventListener("click", function() {
    const controlPanel = document.getElementById('control-panel');
    controlPanel.classList.remove('open');
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
    const controlPanel = document.getElementById('control-panel');

    if (controlPanel.classList.contains('open')) {
        controlPanel.classList.remove('open');
    }
    sidebar.classList.toggle('open');
});

document.getElementById("close-sidebar").addEventListener("click", function() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('open');
});

document.addEventListener('DOMContentLoaded', loadAllData);

document.addEventListener("click", function(event) {
    const controlPanel = document.getElementById('control-panel');
    const sidebar = document.getElementById('sidebar');
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
            if (poiData) {
                addPOILayer(map, poiData, currentLanguage);
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
            map.setFilter('poi-point-labels', null);
            return;
        }

        const filter = [
            'all', 
            ...selectedTags.map(tag => ['in', tag, ['get', 'tags']])
        ];

        map.setFilter('poi-circles', filter);
        map.setFilter('poi-labels', filter);
        map.setFilter('poi-point-labels', filter);
    }); 
});

function initializeMap() {
    map = initializeMapBase(mapboxgl);

    map.on('load', function() {
        if (poiData) {
            addPOILayer(map, poiData, currentLanguage);
            loadAdditionalFeatures();
            setupPOIClickHandlers();
        }
    });

    populateSidebar(poiData);
}

function loadAdditionalFeatures() {
    if (!map.isStyleLoaded()) {
        console.log('Style not loaded, waiting...');
        setTimeout(loadAdditionalFeatures, 100);
        return;
    }

    console.log('Loading additional features...');

    if (polygonsData && linesData && pointsData) {
        ['polygons', 'lines', 'points', 'subpoints'].forEach(sourceId => {
            try {
                const layerId = `${sourceId}-layer`;
                if (map.getLayer(layerId)) {
                    map.removeLayer(layerId);
                }
                if (sourceId === 'subpoints' && map.getLayer('subpoints-labels')) {
                    map.removeLayer('subpoints-labels');
                }
                if (map.getSource(sourceId)) {
                    map.removeSource(sourceId);
                }
            } catch (error) {
                console.log(`Error removing ${sourceId}:`, error);
            }
        });

        addPolygonsLayer(map, polygonsData);
        addLinesLayer(map, linesData);

        const loadIcon = (iconName) => {
            return new Promise((resolve, reject) => {
                map.loadImage(`../resources/icons/${iconName}.png`, (error, image) => {
                    if (error) {
                        console.error(`Error loading icon ${iconName}:`, error);
                        reject(error);
                        return;
                    }
                    if (!map.hasImage(iconName)) {
                        map.addImage(iconName, image);
                    }
                    resolve();
                });
            });
        };

        Promise.all([
            loadIcon('square'),
            loadIcon('restrooms'),
            loadIcon('parking'),
        ]).then(() => {
            if (subpointsData) {
                map.addSource('subpoints', {
                    type: 'geojson',
                    data: subpointsData
                });
    
                map.addLayer({
                    id: 'subpoints-layer',
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
                    id: 'subpoints-labels',
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

                map.on('click', 'subpoints-layer', (e) => {
                    const coordinates = e.features[0].geometry.coordinates.slice();
                    createSubPopup(e, currentLanguage);

                    map.flyTo({
                        center: coordinates,
                        zoom: 15,
                        speed: 1,
                        curve: 1
                    });
                });
            }
                
            return addPointsLayer(map, pointsData);
        }).catch(error => console.error('Error loading icons:', error));
    }
}

function setupPOIClickHandlers() {
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

        if (polygonsData) filterAndShowLayer(map, 'polygons', 'polygons-layer', polygonsData, 'feature', clickedName);
        if (linesData) filterAndShowLayer(map, 'lines', 'lines-layer', linesData, 'feature', clickedName);
        if (pointsData) filterAndShowLayer(map, 'points', 'points-layer', pointsData, 'feature', clickedName);
    });
}

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

function getSidebarImageElement(images, pointId, name) {
    const realImages = hasRealImages(images);
    if (realImages) {
        return `
            <div class="sidebar-image-container">
                <img src="${getImageUrl(images[0])}" alt="${name}" class="point-item-image">
                <span class="sidebar-number-badge">${pointId}</span>
            </div>`;
    } else {
        return `<div class="point-number-circle">${pointId}</div>`;
    }
}

function populateSidebar(data) {
    const pointsList = document.getElementById('points-list');
    pointsList.innerHTML = '';
    
    data.features.forEach(feature => {
        const properties = feature.properties;
        const name = properties[`name_${currentLanguage}`] || '';
        const content = properties[`contents_${currentLanguage}`] || '';
        const images = parseImages(properties.images);
        const pointId = properties.id.split("_")[1] || '';
        
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

        console.log(`Added sidebar item for point ID: ${pointId}, Name: ${name}`);
    });
}

document.querySelectorAll('#language-selector input[name="language"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const pdfLink = document.getElementById("pdf-link");
        
        currentLanguage = e.target.value;
        console.log(`Language set to: ${currentLanguage}`);
        pdfLink.href = `../resources/NatureInTheCity_FINAL_${currentLanguage}.pdf`;
        
        updatePOILanguage(map, currentLanguage);
        
        if (poiData) {
            populateSidebar(poiData);
        }
    });
}); 

function showPreviousImage(images) {
    if (!images.length) return;
    currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
    document.getElementById('current-image').src = getImageUrl(images[currentImageIndex]);
}

function showNextImage(images) {
    if (!images.length) return;
    currentImageIndex = (currentImageIndex + 1) % images.length;
    document.getElementById('current-image').src = getImageUrl(images[currentImageIndex]);
}

function openImageModal(images) {
    const modalHtml = `
        <div id="image-modal" class="modal-overlay">
            <div class="modal-content">
                <img id="modal-image" src="${getImageUrl(images[currentImageIndex])}" alt="Detailed view">
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
        document.getElementById('modal-image').src = getImageUrl(images[currentImageIndex]);
    });

    document.getElementById('modal-next-button').addEventListener('click', (e) => {
        e.stopPropagation(); 
        showNextImage(images);
        document.getElementById('modal-image').src = getImageUrl(images[currentImageIndex]);
    });
}

window.onload = function() {
    if (map) {
        map.addControl(new mapboxgl.NavigationControl());
    }
}

document.getElementById("home-button").addEventListener("click", function() {
    map.fitBounds([[-122.9, 45.53], [-122.3, 45.65]], {bearing: 16});
});

function createPopupFromFeature(feature, lang) {
    if (currentPopup) {
        currentPopup.remove();
        currentPopup = null;
    }

    const coordinates = feature.geometry.coordinates.slice();
    const [longitude, latitude] = coordinates;
    const properties = feature.properties;

    const name = properties[`name_${lang}`] || '';
    const location = properties[`location_${lang}`] || '';
    const content = properties[`contents_${lang}`] || '';
    const pointId = properties.id || '';

    const images = parseImages(properties.images);
    const realImages = hasRealImages(images);

    const imageHtml = getPopupImageHtml(images, pointId);
    const iconsHtml = getIconsHtml(properties.tags);
    const links = properties.links || '';
    const mapLinksHtml = getMapLinksHtml(latitude, longitude);

    const popupContent = `
        <div class="popup-content">
            <div class="popup-top">
                <div class="popup-title">
                    <strong>${name}</strong>
                    <em>${location}</em>
                </div>
            </div>
            <div class="popup-icons">
                ${iconsHtml}
            </div>
            <div class="popup-middle">
                ${content}
            </div>
            <div class="links-container">
                <p><b>Additional information:</b></p>
                <p class="additional-links">${links}</p>
                ${mapLinksHtml}
            </div>
            <div class="image-carousel">
                <div class="image-wrapper">
                    ${imageHtml}
                </div>
                <button class="carousel-button left-button prev-image" style="display:${realImages && images.length > 1 ? 'block' : 'none'};">&#9664;</button>
                <button class="carousel-button right-button next-image" style="display:${realImages && images.length > 1 ? 'block' : 'none'};">&#9654;</button>
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
    
    if (realImages) {
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
    if (currentImage && realImages) {
        currentImage.addEventListener('click', (ev) => {
            ev.stopPropagation();
            openImageModal(images);
        });
    }

    currentPopup = popup;
    return popup;
}