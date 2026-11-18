
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");

const cityName = document.getElementById("cityName");
const temperature = document.getElementById("temperature");
const weatherDescription = document.getElementById("weatherDescription");
const weatherIcon = document.getElementById("weatherIcon");

const feelsLike = document.getElementById("feelsLike");
const highTemp = document.getElementById("highTemp");
const lowTemp = document.getElementById("lowTemp");

const sunrise = document.getElementById("sunrise");
const sunset = document.getElementById("sunset");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("windSpeed");

const aqiValue = document.getElementById("aqiValue");
const aqiStatus = document.getElementById("aqiStatus");

const forecastContainer = document.getElementById("forecastContainer");
const currentDate = document.getElementById("currentDate");

// WMO weather codes used by Open-Meteo
const WEATHER_CODES = {
    0: ["Clear sky", "☀️"],
    1: ["Mainly clear", "🌤️"],
    2: ["Partly cloudy", "⛅"],
    3: ["Overcast", "☁️"],
    45: ["Fog", "🌫️"],
    48: ["Depositing rime fog", "🌫️"],
    51: ["Light drizzle", "🌦️"],
    53: ["Moderate drizzle", "🌦️"],
    55: ["Dense drizzle", "🌧️"],
    56: ["Light freezing drizzle", "🌧️"],
    57: ["Dense freezing drizzle", "🌧️"],
    61: ["Slight rain", "🌦️"],
    63: ["Moderate rain", "🌧️"],
    65: ["Heavy rain", "🌧️"],
    66: ["Light freezing rain", "🌧️"],
    67: ["Heavy freezing rain", "🌧️"],
    71: ["Slight snow", "🌨️"],
    73: ["Moderate snow", "🌨️"],
    75: ["Heavy snow", "❄️"],
    77: ["Snow grains", "🌨️"],
    80: ["Slight rain showers", "🌦️"],
    81: ["Moderate rain showers", "🌧️"],
    82: ["Violent rain showers", "⛈️"],
    85: ["Slight snow showers", "🌨️"],
    86: ["Heavy snow showers", "❄️"],
    95: ["Thunderstorm", "⛈️"],
    96: ["Thunderstorm with slight hail", "⛈️"],
    99: ["Thunderstorm with heavy hail", "⛈️"]
};

function getWeatherDescription(code) {
    return WEATHER_CODES[code]?.[0] ?? "Unknown";
}

function getWeatherIcon(code) {
    return WEATHER_CODES[code]?.[1] ?? "🌡️";
}

// Formats an ISO local time like "2026-11-17T07:21" as "7:21 AM"
function formatTime(value) {
    const match = typeof value === "string" && value.match(/T(\d{1,2}):(\d{2})/);

    if (!match) return "--:--";

    const hour = Number(match[1]);
    const minutes = match[2];

    return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}

// Polar night / midnight sun: API returns 00:00 for both, so use daylight duration instead
function updateDaylight(daily) {
    const daylightSeconds = daily.daylight_duration?.[0];

    if (daylightSeconds === 0) {
        sunrise.textContent = "No sunrise";
        sunset.textContent = "Polar night";
    } else if (daylightSeconds >= 86400) {
        sunrise.textContent = "Midnight sun";
        sunset.textContent = "No sunset";
    } else {
        sunrise.textContent = formatTime(daily.sunrise?.[0]);
        sunset.textContent = formatTime(daily.sunset?.[0]);
    }
}

function renderForecast(daily) {
    forecastContainer.innerHTML = "";

    daily.time.forEach((day, i) => {
        const dayName = new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
            weekday: "short"
        });

        const card = document.createElement("div");
        card.className = "rounded-xl border border-blue-400/20 bg-slate-800/90 p-4 text-center";
        card.innerHTML = `
            <p class="text-xs text-slate-400">${i === 0 ? "Today" : dayName}</p>
            <div class="mt-2 text-3xl">${getWeatherIcon(daily.weather_code[i])}</div>
            <p class="mt-2 text-xs text-slate-400">${getWeatherDescription(daily.weather_code[i])}</p>
            <p class="mt-2 text-sm font-medium">
                ${Math.round(daily.temperature_2m_max[i])}° /
                <span class="text-slate-400">${Math.round(daily.temperature_2m_min[i])}°</span>
            </p>
        `;

        forecastContainer.appendChild(card);
    });
}

function getAqiInfo(aqi) {
    if (aqi <= 20) return ["Good", "#34d399"];
    if (aqi <= 40) return ["Fair", "#a3e635"];
    if (aqi <= 60) return ["Moderate", "#facc15"];
    if (aqi <= 80) return ["Poor", "#fb923c"];
    if (aqi <= 100) return ["Very poor", "#f87171"];
    return ["Extremely poor", "#c084fc"];
}

async function loadAirQuality(latitude, longitude) {
    aqiValue.textContent = "--";
    aqiStatus.textContent = "Loading...";

    try {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Unable to fetch air quality");
        }

        const data = await response.json();
        const aqi = data.current?.european_aqi;

        if (aqi == null) {
            throw new Error("Air quality data unavailable");
        }

        const [status, color] = getAqiInfo(aqi);
        aqiValue.textContent = Math.round(aqi);
        aqiValue.style.color = color;
        aqiStatus.textContent = status;
    } catch (error) {
        console.error("Air quality error:", error);
        aqiValue.textContent = "--";
        aqiValue.style.color = "";
        aqiStatus.textContent = "Unavailable";
    }
}

async function searchCity() {
    const city = cityInput.value.trim();

    if (!city) {
        alert("Please enter a city name");
        return;
    }

    try {
        searchBtn.disabled = true;
        searchBtn.textContent = "Loading...";

        // Step 1: Find city coordinates
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

        const geoResponse = await fetch(geoUrl);

        if (!geoResponse.ok) {
            throw new Error("Unable to find city");
        }

        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            alert("City not found!");
            return;
        }

        const location = geoData.results[0];

        // Step 2: Fetch weather data
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,daylight_duration&timezone=auto&forecast_days=5`;

        const weatherResponse = await fetch(weatherUrl);

        if (!weatherResponse.ok) {
            throw new Error("Unable to fetch weather");
        }

        const weatherData = await weatherResponse.json();

        if (!weatherData.current || !weatherData.daily) {
            throw new Error("Weather data unavailable");
        }

        const current = weatherData.current;
        const daily = weatherData.daily;

        // Step 3: Update location
        cityName.textContent = location.country
            ? `${location.name}, ${location.country}`
            : location.name;

        // Step 4: Update current weather
        temperature.textContent =
            `${Math.round(current.temperature_2m)}°`;

        feelsLike.textContent =
            `Feels like ${Math.round(current.apparent_temperature)}°`;

        weatherDescription.textContent =
            getWeatherDescription(current.weather_code);

        weatherIcon.textContent =
            getWeatherIcon(current.weather_code);

        // Step 5: Update high and low temperature
        highTemp.textContent =
            `H: ${Math.round(daily.temperature_2m_max[0])}°`;

        lowTemp.textContent =
            `L: ${Math.round(daily.temperature_2m_min[0])}°`;

        // Step 6: Update sunrise and sunset
        updateDaylight(daily);

        // Step 7: Update humidity and wind
        humidity.textContent =
            `${current.relative_humidity_2m}%`;

        windSpeed.textContent =
            `${Math.round(current.wind_speed_10m)} km/h`;

        // Step 8: Update forecast
        renderForecast(daily);

        // Step 9: Update air quality (runs independently; failures don't block the rest)
        loadAirQuality(location.latitude, location.longitude);

        // Step 10: Update date
        currentDate.textContent = new Date(
            `${daily.time[0]}T12:00:00`
        ).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric"
        });

        cityInput.value = "";

    } catch (error) {
        console.error("Weather error:", error);
        alert("Unable to find weather data. Please try again.");
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = "Search";
    }
}

// Search button click
searchBtn.addEventListener("click", searchCity);

// Search using Enter key
cityInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        searchCity();
    }
});
