---
id: weather
title: Weather
sidebar_label: Weather
sidebar_position: 13
---

# Weather (`hc-weather`)

This plugin turns the weather for a place into a homeCore device. From
[Open-Meteo](https://open-meteo.com/) it gets the current conditions, today's
figures, a seven-day forecast, the next 24 hours and air quality. From the
national weather service it gets warnings, which become homeCore alerts. It
needs no account or key.

If you install it without setting any places, it reports **the house**, at
the coordinates in homeCore's own `[location]` (the same place sunrise and
sunset come from). To cover anywhere else, add a place by its coordinates,
by a postal code and country, or by its name. A postal code or name is looked
up once and remembered.

## On Home

Each place is a device named `weather_<id>` (`weather_home` for the house).
Add a **Weather** card to any page to see it: the temperature, the humidity,
how it feels, the wind and gusts, and five days with each day's sky. If the
card isn't set to a particular device, it picks the house's weather, and
prefers a device with a forecast over a weather station without one. The
device's own card shows the temperature and the sky ("16°C · Cloudy"), with
the moon on a clear night.

For something livelier, add **Weather, animated** instead. It draws the
current weather as a moving scene: drifting clouds, rain or snow that falls
harder in heavier rain and slants in the wind, sun rays or a moon and stars,
and lightning in a storm. On top of the scene it shows the temperature, a
ribbon when a watch or warning is in force, "Rain in 20 min" when rain is
due, the next few hours, and five days at the large size. The animation stops
when the card is off screen, and stays still for anyone whose phone or
computer is set to reduce motion.

## Readings

Readings are stored in homeCore's units. The app shows °F, mph and inches if
those are what you use.

| Attribute | What |
|---|---|
| `temperature`, `feels_like` | now, °C |
| `humidity`, `cloud_cover_pct` | now, % |
| `dewpoint` | now, °C |
| `pressure` | at sea level, hPa |
| `wind_speed`, `wind_gust` | now, m/s |
| `wind_direction` | where the wind comes from, ° |
| `precipitation_mm` | rain in the last 15 minutes |
| `rain_next_hour_mm` | rain expected in the next hour |
| `rain_starts_in_min`, `rain_soon` | minutes until rain starts (within two hours, else empty), and whether that is within 30 minutes |
| `condition` | `clear`, `partly_cloudy`, `cloudy`, `fog`, `drizzle`, `rain`, `freezing_rain`, `snow`, `showers`, `thunderstorm` |
| `is_day` | day or night |
| `today_high`, `today_low`, `rain_chance_pct`, `snow_today_mm`, `uvi` | today |
| `tonight_low`, `freeze_tonight` | the coldest hour before 9 tomorrow morning, and whether it is at or below freezing |
| `tomorrow_high`, `tomorrow_low` | tomorrow |
| `aqi`, `pm25_ugm3`, `ozone_ugm3` | the air now (US AQI) |
| `aqi_category` | `good` to `hazardous`, the EPA's bands |
| `forecast` | seven days, today first |
| `forecast_hourly` | the next 24 hours |
| `alert_count`, `alert_level`, `alert_headline` | warnings in force (level 0 none, 1 advisory, 2 watch, 3 warning) |

Each day in `forecast` has `time` (the place's midnight, with that day's
offset), `high`, `low`, `condition`, `precipitation_probability`,
`precipitation_mm`, `snowfall_mm` and `wind_gust` (the day's strongest). Each
hour in `forecast_hourly` has `time`, `temperature`, `condition`,
`precipitation_probability`, `precipitation_mm` and `wind_gust`.

Automations can trigger on any of these. For example: rain due within 30
minutes (close the skylight), a freeze tonight (cover the plants), gusts over
15 m/s, the sky turning to snow, or `alert_level` reaching 3.

## Warnings

US places get the National Weather Service's warnings, and European places
get MeteoAlarm's. Each warning in force becomes an alert on the place's
device. It appears in the house's alert list and on Home under Needs
attention, and it clears by itself when the service withdraws it or it
expires. The plugin's page shows each one in full: when it ends, the
service's description, and what it says to do.

| Alert | What | Severity | Shown unless turned off |
|---|---|---|---|
| Weather warning | a warning (tornado, flood, winter storm); MeteoAlarm orange or red | error | yes |
| Weather watch | a watch; MeteoAlarm yellow | warning | yes |
| Weather advisory | an advisory or statement (wind, fog) | info | no |

The kind follows the service's own name for the warning, so a Flood Watch is
a watch however severe the service rates it.

MeteoAlarm lists warnings by region, so a European place needs its region in
its settings, either by code (`DE106`) or by part of its name
(`Nordfriesland`). The US service is queried by point and needs nothing more.

The US service asks every program that reads its warnings to give a contact.
You can enter one under Warnings in the plugin's settings. It is sent only to
api.weather.gov.

## Its page

Settings › Plugins › Weather lists each place with its current weather and
any warnings, where it is, which service its warnings come from, and when
each reading was last fetched (or why it couldn't be). **Refresh now** fetches
everything at once. The plugin's settings are on the same page: places, the
contact, how often each reading is fetched, and the services' addresses (for
a self-hosted Open-Meteo).

## How often

By default the plugin fetches the current weather every 15 minutes (which is
how often Open-Meteo updates it), the forecast every 30, air quality every 15
and warnings every 2. Each has its own timer, so one slow service doesn't
hold up the others. That comes to about 240 calls a day to Open-Meteo per
place, well within the free service's 10,000.

## Data

Weather data by [Open-Meteo.com](https://open-meteo.com/), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Open-Meteo's free
service is for non-commercial use. Warnings come from the US National Weather
Service and [MeteoAlarm](https://meteoalarm.org/).

The no-settings default needs a homeCore that shares the house's location
with plugins. With an older homeCore, add the house as a place.
