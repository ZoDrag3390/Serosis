// ===== LOADING SCREEN =====
window.addEventListener('load', () => {
  const loadingScreen = document.getElementById('loading-screen');
  setTimeout(() => {
      if (loadingScreen) {
          loadingScreen.classList.add('hidden');
      }
      // Initialize language after page is fully loaded
      updatePageText();
  }, 800);
  
  // Load sensors immediately after page load
  setTimeout(loadMultipleSensors, 1000);
  // Connect to WebSocket for real-time updates
  connectWebSocket();
  // Load weather data
  setTimeout(loadWeather, 1200);
});

// ===== WEB SOCKET FOR REAL-TIME UPDATES =====
let websocket = null;

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  websocket = new WebSocket(wsUrl);
  
  websocket.onopen = function(event) {
    console.log('WebSocket connected');
    // Request initial data
    loadMultipleSensors();
  };
  
  websocket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    if (data.type === 'sensor_update') {
      updateSensorsDisplay(data.sensors);
      showNotification('Sensor data updated', 'success');
    } else if (data.type === 'language_changed') {
      currentLanguage = data.language;
      updatePageText();
      
      // Update the select element
      const languageSelect = document.getElementById('languageSelect');
      if (languageSelect) {
        languageSelect.value = data.language;
      }
    }
  };
  
  websocket.onclose = function(event) {
    console.log('WebSocket disconnected, attempting reconnect...');
    setTimeout(connectWebSocket, 3000);
  };
  
  websocket.onerror = function(error) {
    console.error('WebSocket error:', error);
  };
}

// ===== SIDE MENU =====
const menuBtn = document.getElementById('menuBtn');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');

if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    const open = sideMenu.classList.toggle('open');
    overlay.classList.toggle('show', open);
  });
}

if (overlay) {
  overlay.addEventListener('click', () => {
    sideMenu.classList.remove('open');
    overlay.classList.remove('show');
  });
}

// ===== MULTI-SENSOR DASHBOARD =====
async function loadMultipleSensors() {
  try {
    const res = await fetch('/api/sensors');
    const sensors = await res.json();
    updateSensorsDisplay(sensors);
  } catch (err) {
    console.error('Error fetching sensors:', err);
    showNotification('Failed to load sensors', 'error');
  }
}

function updateSensorsDisplay(sensors) {
  const container = document.getElementById('sensors-container');
  if (!container) return;

  // Clear existing content
  container.innerHTML = '';

  // Create sensor elements for each sensor
  Object.entries(sensors).forEach(([sensorId, sensorData]) => {
    const sensorElement = createSensorElement(sensorId, sensorData);
    container.appendChild(sensorElement);
  });

  // If no sensors, show message
  if (Object.keys(sensors).length === 0) {
    container.innerHTML = '<div class="no-sensors">No sensors connected</div>';
  }

  // Update sensor count in header if it exists
  const sensorsHeader = document.querySelector('.sensors-header h2');
  if (sensorsHeader) {
    sensorsHeader.textContent = `Field Sensors (${Object.keys(sensors).length} active)`;
  }
}

function createSensorElement(sensorId, sensorData) {
  const div = document.createElement('div');
  div.className = 'sensor-item multi-sensor';
  div.innerHTML = `
    <div class="sensor-header">
      <img src="/static/soil.png" class="sensor-icon" alt="Sensor">
      <div class="sensor-info">
        <div class="sensor-name">${sensorData.name || sensorId}</div>
        <div class="sensor-meta">
          <span class="battery">🔋 ${sensorData.battery || 0}%</span>
          <span class="location">📍 ${sensorData.location?.x || 0},${sensorData.location?.y || 0}</span>
          <span class="last-update">🕒 ${formatTime(sensorData.last_update)}</span>
        </div>
      </div>
    </div>
    
    <div class="sensor-readings">
      <div class="reading">
        <div class="reading-label">MOISTURE</div>
        <div class="reading-value ${getStatusClass(sensorData.moisture_status)}">${sensorData.moisture}%</div>
        <div class="reading-status">${sensorData.moisture_status}</div>
      </div>
      
      <div class="reading">
        <div class="reading-label">TEMPERATURE</div>
        <div class="reading-value ${getStatusClass(sensorData.temp_status)}">${sensorData.temperature}°C</div>
        <div class="reading-status">${sensorData.temp_status}</div>
      </div>
      
      <div class="reading">
        <div class="reading-label">HUMIDITY</div>
        <div class="reading-value ${getStatusClass(sensorData.humidity_status)}">${sensorData.humidity}%</div>
        <div class="reading-status">${sensorData.humidity_status}</div>
      </div>
    </div>
  `;
  return div;
}

function formatTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function getStatusClass(status) {
  switch(status) {
    case 'OPTIMAL': return 'status-optimal';
    case 'GOOD': return 'status-good';
    case 'LOW': return 'status-low';
    case 'HIGH': return 'status-high';
    case 'COLD': return 'status-cold';
    case 'HOT': return 'status-hot';
    case 'DANGER': return 'status-danger';
    default: return 'status-unknown';
  }
}

// ===== NOTIFICATION SYSTEM =====
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notif => notif.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span class="notification-message">${message}</span>
    <button class="notification-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 3000);
}

// ===== ANALYTICS PAGE WITH ML PREDICTIONS =====
if (window.location.pathname === '/analytics') {
  // Load all analytics data
  loadFieldMap();
  loadFieldHealth();
  loadYieldPrediction();
  loadHarvestPrediction();
  
  // Refresh analytics every 30 seconds
  setInterval(() => {
    loadFieldMap();
    loadFieldHealth();
    loadYieldPrediction();
    loadHarvestPrediction();
  }, 30000);
  
  // Yield Prediction Functions
  async function loadYieldPrediction() {
    try {
      const response = await fetch('/api/predict-yield');
      const data = await response.json();
      
      document.getElementById('predictedYield').textContent = data.prediction.predicted_yield;
      document.getElementById('averageYield').textContent = data.prediction.average_yield + ' tons';
      document.getElementById('yieldTrend').textContent = data.prediction.trend + ' average';
      document.getElementById('confidenceLevel').textContent = data.prediction.confidence;
      document.getElementById('yieldRecommendation').textContent = data.prediction.recommendation;
      
      // Style confidence badge
      const confidenceBadge = document.getElementById('confidenceLevel');
      confidenceBadge.className = 'confidence-badge ' + data.prediction.confidence;
      
    } catch (error) {
      console.error('Error loading yield prediction:', error);
      document.getElementById('yieldRecommendation').textContent = 'Prediction temporarily unavailable';
    }
  }

  async function loadHarvestPrediction() {
    try {
      const response = await fetch('/api/harvest-prediction');
      const data = await response.json();
      
      document.getElementById('harvestDate').textContent = data.harvest_prediction.optimal_harvest_date;
      document.getElementById('daysRemaining').textContent = data.harvest_prediction.days_remaining;
      document.getElementById('harvestStatus').textContent = data.harvest_prediction.status;
      document.getElementById('harvestMessage').textContent = data.harvest_prediction.message;
      
    } catch (error) {
      console.error('Error loading harvest prediction:', error);
      document.getElementById('harvestMessage').textContent = 'Harvest prediction temporarily unavailable';
    }
  }

  // Existing charts code
  const charts = {
    moisture: new Chart(document.getElementById('moistureChart'), {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Moisture (%)', data: [], borderColor: '#4a3c25', backgroundColor: 'rgba(189,140,74,0.2)', fill: true, tension: 0.4 }] },
      options: { scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }
    }),
    temp: new Chart(document.getElementById('tempChart'), {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Soil Temp (°C)', data: [], borderColor: '#b46b3b', backgroundColor: 'rgba(230,170,110,0.3)', fill: true, tension: 0.4 }] },
      options: { scales: { y: { min: 10, max: 40 } }, plugins: { legend: { display: false } } }
    }),
    humidity: new Chart(document.getElementById('humidityChart'), {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Humidity (%)', data: [], borderColor: '#2a6b5b', backgroundColor: 'rgba(160,200,180,0.3)', fill: true, tension: 0.4 }] },
      options: { scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }
    })
  };

  let counter = 0;
  async function updateAnalytics() {
    const res = await fetch('/api/data');
    const data = await res.json();
    const sensors = { moisture: data.moisture, temp: data.temperature, humidity: data.humidity };

    for (let key in charts) {
      const chart = charts[key];
      chart.data.labels.push(counter + "s");
      chart.data.datasets[0].data.push(sensors[key]);
      if (chart.data.labels.length > 12) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      chart.update();
    }
    counter += 5;
  }

  setInterval(updateAnalytics, 5000);
}

// Field map functions
async function loadFieldMap() {
  try {
    const response = await fetch('/api/field-map');
    const data = await response.json();
    
    updateFieldMapDisplay(data);
    updateRecommendations(data.recommendations);
    updateMapInfo(data.sensor_count, data.generated_at);
    
  } catch (error) {
    console.error('Error loading field map:', error);
  }
}

async function loadFieldHealth() {
  try {
    const response = await fetch('/api/field-health');
    const data = await response.json();
    
    updateHealthDisplay(data);
    
  } catch (error) {
    console.error('Error loading field health:', error);
  }
}

function updateFieldMapDisplay(data) {
  const fieldMap = document.getElementById('fieldMap');
  if (!fieldMap) return;
  
  fieldMap.innerHTML = '';
  
  data.field_grid.forEach((row, y) => {
    row.forEach((moisture, x) => {
      const cell = document.createElement('div');
      cell.className = `map-cell ${getMoistureLevelClass(moisture)}`;
      cell.textContent = `${moisture}%`;
      cell.title = `Position: ${x},${y} - Moisture: ${moisture}%`;
      fieldMap.appendChild(cell);
    });
  });
}

function getMoistureLevelClass(moisture) {
  if (moisture < 30) return 'moisture-critical';
  if (moisture < 50) return 'moisture-low';
  if (moisture < 70) return 'moisture-medium';
  return 'moisture-high';
}

function updateRecommendations(recommendations) {
  const container = document.getElementById('recommendationsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (recommendations.length === 0) {
    container.innerHTML = '<div class="recommendation-loading">No recommendations at this time</div>';
    return;
  }
  
  recommendations.forEach(rec => {
    const div = document.createElement('div');
    div.className = 'recommendation-item';
    div.textContent = rec;
    container.appendChild(div);
  });
}

function updateMapInfo(sensorCount, generatedAt) {
  const sensorCountEl = document.getElementById('sensorCount');
  const mapTimeEl = document.getElementById('mapTime');
  
  if (sensorCountEl) {
    sensorCountEl.textContent = `Sensors: ${sensorCount}`;
  }
  
  if (mapTimeEl) {
    const time = new Date(generatedAt).toLocaleTimeString();
    mapTimeEl.textContent = `Last updated: ${time}`;
  }
}

function updateHealthDisplay(data) {
  const healthScoreEl = document.getElementById('healthScore');
  const healthCropEl = document.getElementById('healthCrop');
  const healthRangeEl = document.getElementById('healthRange');
  const healthCircle = document.querySelector('.health-circle');
  
  if (healthScoreEl) healthScoreEl.textContent = data.health_score;
  if (healthCropEl) healthCropEl.textContent = `Crop: ${data.crop}`;
  if (healthRangeEl) healthRangeEl.textContent = `Optimal Range: ${data.optimal_range}`;
  
  if (healthCircle) {
    healthCircle.style.background = `conic-gradient(#1b7b50 ${data.health_score}%, #e8dbc1 ${data.health_score}%)`;
  }
}

// ===== WEATHER UPDATES =====
async function loadWeather() {
    try {
        const response = await fetch('/api/weather');
        const weatherData = await response.json();
        
        updateWeatherDisplay(weatherData);
    } catch (error) {
        console.error('Error loading weather:', error);
    }
}

function updateWeatherDisplay(weatherData) {
    const tempEl = document.getElementById('weatherTemp');
    const descEl = document.getElementById('weatherDesc');
    const iconEl = document.getElementById('weatherIcon');
    const alertEl = document.getElementById('weatherAlert');
    const alertTextEl = document.getElementById('alertText');
    
    if (tempEl && weatherData.current) {
        tempEl.textContent = `${weatherData.current.temperature}°C`;
    }
    
    if (descEl && weatherData.current) {
        descEl.textContent = weatherData.current.description;
    }
    
    if (iconEl && weatherData.current) {
        iconEl.textContent = weatherData.current.icon || '⛅';
    }
    
    if (alertEl && alertTextEl && weatherData.alerts && weatherData.alerts.length > 0) {
        alertTextEl.textContent = weatherData.alerts[0];
        alertEl.style.display = 'flex';
    } else if (alertEl) {
        alertEl.style.display = 'none';
    }
}

// ===== LANGUAGE MANAGEMENT =====
let currentLanguage = 'en';

// Translation dictionaries
const translations = {
    'en': {
        'dashboard_title': 'SEROSIS Dashboard',
        'welcome': 'WELCOME TO',
        'monitoring_for': 'Monitoring for',
        'change_crop': 'Change Crop',
        'field_sensors': 'Field Sensors',
        'active': 'active',
        'loading': 'Loading...',
        'no_sensors': 'No sensors connected',
        'moisture': 'MOISTURE',
        'temperature': 'TEMPERATURE', 
        'humidity': 'HUMIDITY',
        'optimal': 'OPTIMAL',
        'good': 'GOOD',
        'low': 'LOW',
        'high': 'HIGH',
        'cold': 'COLD',
        'hot': 'HOT',
        'danger': 'DANGER',
        'about': 'About',
        'contact': 'Contact',
        'guide': 'Guide',
        'analytics': 'Analytics',
        'select_crop': 'Select Crop',
        'back': 'Back',
        'water': 'Water',
        'season': 'Season',
        'partly_cloudy': 'Partly Cloudy',
        'heavy_rain': 'Heavy rain expected tomorrow',
        'setup': 'Setup',
        'tips': 'Tips'
    },
    'hi': {
        'dashboard_title': 'SEROSIS डैशबोर्ड',
        'welcome': 'आपका स्वागत है',
        'monitoring_for': 'निगरानी के लिए',
        'change_crop': 'फसल बदलें',
        'field_sensors': 'खेत सेंसर',
        'active': 'सक्रिय',
        'loading': 'लोड हो रहा है...',
        'no_sensors': 'कोई सेंसर जुड़े नहीं हैं',
        'moisture': 'नमी',
        'temperature': 'तापमान',
        'humidity': 'आर्द्रता',
        'optimal': 'इष्टतम',
        'good': 'अच्छा',
        'low': 'कम',
        'high': 'उच्च',
        'cold': 'ठंडा',
        'hot': 'गर्म',
        'danger': 'खतरा',
        'about': 'हमारे बारे में',
        'contact': 'संपर्क करें',
        'guide': 'मार्गदर्शिका',
        'analytics': 'विश्लेषण',
        'select_crop': 'फसल चुनें',
        'back': 'वापस',
        'water': 'पानी',
        'season': 'मौसम',
        'partly_cloudy': 'आंशिक रूप से बादल',
        'heavy_rain': 'कल भारी बारिश की संभावना',
        'setup': 'सेटअप',
        'tips': 'टिप्स'
    }
};

function translate(key) {
    return translations[currentLanguage]?.[key] || translations['en'][key] || key;
}

function updatePageText() {
    console.log('Updating page text for language:', currentLanguage);
    
    // Update all text elements
    const elementsToTranslate = {
        'welcomeText': 'welcome',
        'monitoringLabel': 'monitoring_for',
        'changeCropBtn': 'change_crop',
        'sensorsHeader': 'field_sensors',
        'loadingText': 'loading'
    };
    
    for (const [elementId, translationKey] of Object.entries(elementsToTranslate)) {
        const element = document.getElementById(elementId);
        if (element) {
            if (elementId === 'sensorsHeader') {
                const sensorCount = document.querySelectorAll('.sensor-item').length;
                element.textContent = `${translate('field_sensors')} (${sensorCount} ${translate('active')})`;
            } else if (elementId === 'monitoringLabel') {
                element.textContent = translate(translationKey) + ':';
            } else {
                element.textContent = translate(translationKey);
            }
        }
    }
    
    // Update sensor labels
    document.querySelectorAll('.reading-label').forEach(label => {
        const originalText = label.textContent;
        if (originalText.includes('MOISTURE') || originalText.includes('नमी')) {
            label.textContent = translate('moisture');
        } else if (originalText.includes('TEMPERATURE') || originalText.includes('तापमान')) {
            label.textContent = translate('temperature');
        } else if (originalText.includes('HUMIDITY') || originalText.includes('आर्द्रता')) {
            label.textContent = translate('humidity');
        }
    });
    
    // Update status labels
    document.querySelectorAll('.reading-status').forEach(status => {
        const originalText = status.textContent;
        if (originalText.includes('OPTIMAL') || originalText.includes('इष्टतम')) {
            status.textContent = translate('optimal');
        } else if (originalText.includes('GOOD') || originalText.includes('अच्छा')) {
            status.textContent = translate('good');
        } else if (originalText.includes('LOW') || originalText.includes('कम')) {
            status.textContent = translate('low');
        } else if (originalText.includes('HIGH') || originalText.includes('उच्च')) {
            status.textContent = translate('high');
        } else if (originalText.includes('COLD') || originalText.includes('ठंडा')) {
            status.textContent = translate('cold');
        } else if (originalText.includes('HOT') || originalText.includes('गर्म')) {
            status.textContent = translate('hot');
        } else if (originalText.includes('DANGER') || originalText.includes('खतरा')) {
            status.textContent = translate('danger');
        }
    });
    
    // Update weather text
    const weatherDesc = document.getElementById('weatherDesc');
    const alertText = document.getElementById('alertText');
    if (weatherDesc && weatherDesc.textContent.includes('Partly Cloudy')) {
        weatherDesc.textContent = translate('partly_cloudy');
    }
    if (alertText && alertText.textContent.includes('Heavy rain')) {
        alertText.textContent = translate('heavy_rain');
    }
    
    // Update side menu
    document.querySelectorAll('.side-inner a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === '/about') link.textContent = translate('about');
        else if (href === '/crops') link.textContent = translate('select_crop');
        else if (href === '/contact') link.textContent = translate('contact');
        else if (href === '/guide') link.textContent = translate('guide');
        else if (href === '/analytics') link.textContent = translate('analytics');
    });
    
    // Update page title
    document.title = translate('dashboard_title');
}

async function changeLanguage(languageCode) {
    try {
        console.log('Changing language to:', languageCode);
        
        const response = await fetch('/api/change-language', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({language_code: languageCode})
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            currentLanguage = languageCode;
            updatePageText();
            showNotification(`Language changed to ${languageCode === 'en' ? 'English' : 'Hindi'}`, 'success');
            
            // Update the select element to show the current selection
            const languageSelect = document.getElementById('languageSelect');
            if (languageSelect) {
                languageSelect.value = languageCode;
            }
        } else {
            showNotification('Failed to change language', 'error');
        }
    } catch (error) {
        console.error('Error changing language:', error);
        showNotification('Failed to change language', 'error');
    }
}

// Initialize language on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing language');
    
    // Set initial language from select element or default to English
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        currentLanguage = languageSelect.value;
        console.log('Initial language set to:', currentLanguage);
    }
    
    // Update page text after a short delay to ensure DOM is fully loaded
    setTimeout(updatePageText, 100);
});

// Auto-refresh sensors every 5 seconds
setInterval(loadMultipleSensors, 5000);

// Refresh weather every 30 minutes
setInterval(loadWeather, 30 * 60 * 1000);