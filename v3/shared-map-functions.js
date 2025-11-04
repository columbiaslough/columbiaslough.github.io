export const MAP_CONFIG = {
    accessToken: 'pk.eyJ1IjoiY29sdW1iaWFzbG91Z2giLCJhIjoiY201MWFrbTBmMHN1aTJwcHd1dHloMGs4YyJ9.kQj7ux3XSeQiOBwxzM5B9g',
    style: 'mapbox://styles/mapbox/satellite-streets-v11',
    bounds: [[-122.8, 45.53], [-122.45, 45.65]],
    bearing: 16
};

export const LAYER_STYLES = {
    polygons: {
        paint: {
            'fill-color': '#33ff99',
            'fill-opacity': 0.3,
            'fill-outline-color': '#d7f531'
        },
        minzoom: 13
    },
    lines: {
        paint: {
            'line-color': '#ff5773',
            'line-width': 2
        },
        minzoom: 13
    },
    points: {
        paint: {
            'circle-radius': 8,
            'circle-color': '#ff0000',
            'circle-opacity': 0.7
        },
        minzoom: 13
    },
    poi: {
        circles: {
            paint: {
                'circle-radius': 9,
                'circle-color': '#dc9c3c',
                'circle-opacity': 1
            }
        },
        labels: {
            layout: {
                'text-field': ['get', 'labelId'],
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
        },
        pointLabels: {
            layout: {
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
        }
    }
};

export function initializeMapBase(mapboxgl) {
    mapboxgl.accessToken = MAP_CONFIG.accessToken;
    const map = new mapboxgl.Map({
        container: 'map',
        style: MAP_CONFIG.style,
        bounds: MAP_CONFIG.bounds
    });
    map.setBearing(MAP_CONFIG.bearing);
    return map;
}

export function addPolygonsLayer(map, data) {
    if (!data || !data.features || data.features.length === 0) {
        console.warn('No polygon features to add');
        return;
    }

    map.addSource('polygons', {
        type: 'geojson',
        data: data
    });

    map.addLayer({
        id: 'polygons-layer',
        type: 'fill',
        source: 'polygons',
        paint: LAYER_STYLES.polygons.paint,
        layout: { visibility: 'none' },
        minzoom: LAYER_STYLES.polygons.minzoom
    });
}

export function addLinesLayer(map, data) {
    if (!data || !data.features || data.features.length === 0) {
        console.warn('No line features to add');
        return;
    }

    map.addSource('lines', {
        type: 'geojson',
        data: data
    });

    map.addLayer({
        id: 'lines-layer',
        type: 'line',
        source: 'lines',
        paint: LAYER_STYLES.lines.paint,
        layout: { visibility: 'none' },
        minzoom: LAYER_STYLES.lines.minzoom
    });
}

export function addPointsLayer(map, data, iconNames = ['restrooms', 'parking', 'boats']) {
    if (!data || !data.features || data.features.length === 0) {
        console.warn('No point features to add');
        return Promise.resolve();
    }

    console.log('Points data:', data);

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

    return Promise.all(iconNames.map(icon => loadIcon(icon)))
        .then(() => {
            map.addSource('points', {
                type: 'geojson',
                data: data
            });

            map.addLayer({
                id: 'points-layer',
                type: 'symbol',
                source: 'points',
                layout: {
                    'icon-image': ['get', 'icon_type'],
                    'icon-size': 0.09,
                    'visibility': 'none'
                },
                minzoom: LAYER_STYLES.points.minzoom
            });
        })
        .catch(error => console.error('Error loading point icons:', error));
}

export function addPOILayer(map, data, currentLanguage = 'en') {
    if (!data || !data.features || !Array.isArray(data.features)) {
        console.error('Invalid POI data structure:', data);
        return;
    }

    map.addSource('poi', {
        type: 'geojson',
        data: data
    });

    map.addLayer({
        id: 'poi-circles',
        type: 'circle',
        source: 'poi',
        paint: LAYER_STYLES.poi.circles.paint
    });

    map.addLayer({
        id: 'poi-labels',
        type: 'symbol',
        source: 'poi',
        layout: LAYER_STYLES.poi.labels.layout,
        paint: LAYER_STYLES.poi.labels.paint
    });

    map.addLayer({
        id: 'poi-point-labels',
        type: 'symbol',
        source: 'poi',
        layout: {
            ...LAYER_STYLES.poi.pointLabels.layout,
            'text-field': ['get', `name_${currentLanguage}`]
        },
        paint: LAYER_STYLES.poi.pointLabels.paint
    });
}

export function parseImages(imagesString) {
    if (!imagesString) return [];
    return imagesString.split(',').map(img => img.trim()).filter(Boolean);
}

export function hasRealImages(images) {
    return images.length > 0 && images[0] !== 'image0' && images[0].startsWith('http');
}

export function getImageUrl(imageUrl) {
    if (imageUrl && imageUrl.startsWith('http')) {
        return imageUrl;
    }
}

export function filterAndShowLayer(map, sourceId, layerId, data, property, filterValue) {
    if (!data || !data.features) {
        console.log(`No data available for ${sourceId}`);
        return;
    }

    const source = map.getSource(sourceId);
    if (!source) {
        console.log(`Source ${sourceId} not found`);
        return;
    }

    try {
        const matchingFeatures = data.features.filter(
            feature => feature.properties[property] === filterValue
        );

        if (matchingFeatures.length > 0) {
            const filteredData = {
                type: 'FeatureCollection',
                features: matchingFeatures
            };
            source.setData(filteredData);
            map.setLayoutProperty(layerId, 'visibility', 'visible');
            console.log(`Showing ${layerId} with ${matchingFeatures.length} features`);
        } else {
            map.setLayoutProperty(layerId, 'visibility', 'none');
        }
    } catch (error) {
        console.error(`Error filtering ${sourceId}:`, error);
    }
}

export function updatePOILanguage(map, language) {
    if (map.getLayer('poi-point-labels')) {
        map.setLayoutProperty('poi-point-labels', 'text-field', ['get', `name_${language}`]);
    }
}

export function getPopupImageHtml(images, pointId, isEditable = false) {
    const realImages = hasRealImages(images);
    
    if (realImages) {
        return `<img id="current-image" src="${images[0]}" alt="picture" class="popup-image" />`;
    } else {
        return `<p class="no-images-message">No images available</p>`;
    }
}

export function getIconsHtml(tagsInput) {
    if (!tagsInput) return '';
    
    const tags = Array.isArray(tagsInput) 
        ? tagsInput 
        : tagsInput.split(',').map(tag => tag.trim()).filter(Boolean);
    
    return tags.map(tag => `
        <div class="icon-container" title="${tag}">
            <img src="../resources/icons/${tag}.svg" alt="${tag}" class="icon-image">
        </div>
    `).join('');
}

export function getMapLinksHtml(latitude, longitude) {
    return `
        <div class="map-icons">
            <div class="map-icon-container" title="Open in Google Maps">
                <a href="https://maps.google.com/?q=${latitude},${longitude}" target="_blank">
                    <img src="https://www.vectorlogo.zone/logos/google_maps/google_maps-icon.svg" class="icon-image">
                </a>
            </div>
            <div class="map-icon-container" title="Open in Apple Maps">
                <a href="http://maps.apple.com/?q=${latitude},${longitude}" target="_blank">
                    <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQk4kU3uCXeJ2uIbJL0bZQbm1KNRjnI7vW3Ww&s" class="icon-image">
                </a>
            </div>
            <div class="map-icon-container" title="Open in Bing Maps">
                <a href="https://bing.com/maps/default.aspx?cp=${latitude}~${longitude}&lvl=15" target="_blank">
                    <img src="https://download.logo.wine/logo/Bing_Maps_Platform/Bing_Maps_Platform-Logo.wine.png" class="icon-image">
                </a>
            </div>
        </div>
    `;
}