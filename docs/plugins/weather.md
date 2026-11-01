---
id: weather
title: Weather
sidebar_label: Weather
sidebar_position: 13
---

# Weather (`hc-weather`)

The weather for a place, as a homeCore device: the weather now, today's
figures, seven days, the next 24 hours and the air, from
[Open-Meteo](https://open-meteo.com/); and the national weather service's
warnings, as homeCore alerts. It needs no account or key.

Installed with no places set, it reports **the house**, at the coordinates
in homeCore's own `[location]` (where sunrise and sunset come from). Add a
place for anywhere else: by its coordinates, by a postal code and country,
or by its name. A postal code or name is looked up once and remembered.

## On Home

Each place is a device, `weather_<id>` (`weather_home` for the house). Add a
**Weather** card to any page to see it: the temperature, the humidity, how
it feels, the wind and gusts, and five days with each day's sky. When the
card isn't set to a particular device, it picks the house's weather with a
forecast before a weather station without one. The device's own card says
the temperature and the sky ("16°C · Cloudy"), with the moon on a clear
night.

## Readings

All in homeCore's units: the app shows °F, mph and inches if that's what you
read.

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
`precipitation_mm`, `snowfall_mm` and `wind_gust` (the day's strongest). Each hour in `forecast_hourly` has `time`, `temperature`,
`condition`, `precipitation_probability`, `precipitation_mm` and `wind_gust`.

Automations can start on any of these: rain due within 30 minutes (close the
skylight), a freeze tonight (cover the plants), gusts over 15 m/s, the sky
turning to snow, `alert_level` reaching 3.

## Warnings

US places get the National Weather Service's warnings; European places get
MeteoAlarm's. Each one in force is an alert on the place's device, in the
house's alert list and on Home under Needs attention, and it clears by itself
when the service withdraws it or it runs out. The plugin's page shows each one
in full: when it ends, the service's description, and what it says to do.

| Alert | What | Severity | Shown unless turned off |
|---|---|---|---|
| Weather warning | a warning (tornado, flood, winter storm); MeteoAlarm orange or red | error | yes |
| Weather watch | a watch; MeteoAlarm yellow | warning | yes |
| Weather advisory | an advisory or statement (wind, fog) | info | no |

The kind follows what the service calls it, so a Flood Watch is a watch
however severe the service rates it.

MeteoAlarm lists warnings by region, so a European place needs its region in
its settings, by code (`DE106`) or part of its name (`Nordfriesland`). The US
service is asked by point, and needs nothing more.

The US service asks every program that reads its warnings for a contact. Give
one under Warnings in the plugin's settings if you like; it is sent only to
api.weather.gov.

## Its page

Settings › Plugins › Weather shows each place with the weather there now and
any warnings, where it is, whose warnings it gets, and when each reading was
last fetched or why it couldn't be. **Refresh now** reads everything at once.
The plugin's settings are on the same page: places, the contact, how often
each reading is fetched, and the services' addresses (for a self-hosted
Open-Meteo).

## How often

The weather now every 15 minutes (as often as Open-Meteo updates it), the
forecast every 30, the air every 15, warnings every 2. Each has its own timer,
so one slow service holds up nothing else. That is about 240 calls a day to
Open-Meteo for each place, within its free service's 10,000.

## Data

Weather data by [Open-Meteo.com](https://open-meteo.com/), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Open-Meteo's free
service is for non-commercial use. Warnings from the US National Weather
Service and [MeteoAlarm](https://meteoalarm.org/).

Needs homeCore with the house's location shared with plugins for the
no-settings default; with an older homeCore, add the house as a place.
