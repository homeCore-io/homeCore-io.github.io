---
id: weather
title: Weather
sidebar_label: Weather
sidebar_position: 13
---

import PluginFacts from '@site/src/components/PluginFacts';

# Weather (`hc-weather`)

<PluginFacts
  mark="We"
  kind="weather"
  summary="Turns the weather for a place into a homeCore device, with forecasts, air quality and warnings."
  version="0.1.4"
  runs="Under core (Rust)"
  talks="Open-Meteo, online"
  account="None"
  devices={["weather"]}
  source="https://github.com/homeCore-io/homeCore/tree/develop/plugins/hc-weather"
  setup="#install-and-set-up"
/>

This plugin turns the weather for a place into a homeCore device. From
[Open-Meteo](https://open-meteo.com/) it gets the current conditions, today's
figures, a seven day forecast, the next 24 hours and air quality. From the US
National Weather Service or MeteoAlarm in Europe it gets warnings, which
become homeCore alerts.

## Before you start

You need no account and no API key. The host that runs the plugin needs
internet access to reach Open-Meteo, and to reach `api.weather.gov` or
MeteoAlarm for warnings.

To use the house's own location with no settings at all, homeCore needs its
`[location]` set (the same place sunrise and sunset come from) and has to be
new enough to share it with plugins. With an older homeCore, add the house
as a place yourself.

## Install and set up

1. Install Weather from **Settings › Plugins › Catalog**. Its settings are on
   its page under **Settings › Plugins › Weather**.
2. With no places set, it reports the house at homeCore's location, as the
   device `weather_home`.
3. To cover somewhere else, add a place under **Places**. Give it an id and a
   name, then either its latitude and longitude, a postal code and two letter
   country, or a place name under **Or its name**. The plugin looks up a postal code or
   name once and remembers the answer.
4. For a European place, fill in **MeteoAlarm region** to get warnings (see
   [Alerts](#alerts)).
5. For US warnings, fill in **Contact for the weather service** under
   **Warnings**.

The id names the place's device (`weather_<id>`) for good, since history and
automations are keyed to it. When you remove a place, its device is removed
too, but only once every remaining place has been found, so a failed lookup
never removes a working device.

## Settings

| Setting | Key | Default | What it does |
|---|---|---|---|
| Places | `weather.locations` | empty | The places to report. Empty means the house. |
| Contact for the weather service | `weather.contact` | empty | An email or other contact the US National Weather Service asks every program to send. It goes only to `api.weather.gov`, in the request's User-Agent. |
| The weather now | `weather.current_interval_secs` | `900` | Seconds between reads of the current weather. Minimum 300. Open-Meteo updates it every 15 minutes. |
| The forecast | `weather.forecast_interval_secs` | `1800` | Seconds between forecast reads. Minimum 600. |
| Air quality | `weather.air_quality_interval_secs` | `900` | Seconds between air quality reads. Minimum 600. |
| Warnings | `weather.alerts_interval_secs` | `120` | Seconds between warning checks. Minimum 60. |
| Open-Meteo forecast | `weather.forecast_url` | `https://api.open-meteo.com/v1/forecast` | Change it only for your own Open-Meteo server. |
| Open-Meteo air quality | `weather.air_quality_url` | `https://air-quality-api.open-meteo.com/v1/air-quality` | |
| Open-Meteo places | `weather.geocoding_url` | `https://geocoding-api.open-meteo.com/v1/search` | Used to look up postal codes and names. |
| National Weather Service | `weather.nws_url` | `https://api.weather.gov` | |
| MeteoAlarm | `weather.meteoalarm_url` | `https://feeds.meteoalarm.org/api/v1/warnings` | |
| Forward to core | `logging.forward_level` | `info` | The lowest log level sent to homeCore. |

Each place in **Places** has these columns:

| Column | Key | What it does |
|---|---|---|
| (id) | `id` | Names the device, `weather_<id>`. |
| Name | `name` | Shown in the app. The device is called by the name plus "weather". |
| Latitude, Longitude | `latitude`, `longitude` | Used as given. |
| Postal code, Country (two letters) | `postal_code`, `country` | Looked up once if there are no coordinates. |
| Or its name | `query` | A place name, looked up once. |
| Warnings from | `alerts` | `auto` (the default) picks by where the place is. Also `nws`, `meteoalarm` or `off`. |
| MeteoAlarm region | `meteoalarm_area` | The region's code (`DE106`) or part of its name (`Nordfriesland`). |

With `auto`, a place in the US or Puerto Rico gets National Weather Service
warnings. A place in a country MeteoAlarm covers gets MeteoAlarm warnings
if it has a region, and none if it doesn't. Anywhere else gets none.

Each kind of reading has its own timer, so one slow service doesn't hold up
the others. The defaults come to about 240 calls a day to Open-Meteo per place,
well inside the free service's limit of 10,000.

## Devices

Each place is a device of type `weather`, with the id `weather_<id>`
(`weather_home` for the house). Every reading is read only. Readings use
homeCore's units, and the app shows °F, mph and inches to people who use
them.

| Attribute | What it holds |
|---|---|
| `temperature`, `feels_like`, `dewpoint` | now, °C |
| `humidity`, `cloud_cover_pct` | now, % |
| `pressure` | at sea level, hPa |
| `wind_speed`, `wind_gust` | now, m/s |
| `wind_direction` | where the wind comes from, degrees |
| `precipitation_mm` | rain in the last 15 minutes, mm |
| `rain_next_hour_mm` | rain expected in the next hour, mm |
| `rain_starts_in_min` | minutes until rain starts, if it starts within two hours; otherwise empty |
| `rain_soon` | true when rain starts within 30 minutes |
| `condition` | `clear`, `partly_cloudy`, `cloudy`, `fog`, `drizzle`, `rain`, `freezing_rain`, `snow`, `showers` or `thunderstorm` |
| `is_day` | true by day, false at night |
| `today_high`, `today_low` | today, °C |
| `rain_chance_pct`, `snow_today_mm`, `uvi` | today's chance of rain, snowfall and highest UV index |
| `tonight_low` | the coldest hour from now until 9 tomorrow morning, °C |
| `freeze_tonight` | true when `tonight_low` is at or below 0 °C |
| `tomorrow_high`, `tomorrow_low` | tomorrow, °C |
| `aqi` | US AQI now |
| `aqi_category` | `good`, `moderate`, `unhealthy_sensitive`, `unhealthy`, `very_unhealthy` or `hazardous` (the EPA's bands) |
| `pm25_ugm3`, `ozone_ugm3` | µg/m³ |
| `forecast` | seven days, today first |
| `forecast_hourly` | the next 24 hours |
| `alert_count` | how many warnings are in force |
| `alert_level` | the highest: 0 none, 1 advisory, 2 watch, 3 warning |
| `alert_headline` | the most serious warning's headline |

Each day in `forecast` has `time` (the place's local midnight, with that
day's UTC offset), `high`, `low`, `condition`, `precipitation_probability`,
`precipitation_mm`, `snowfall_mm` and `wind_gust` (the day's strongest).
Each hour in `forecast_hourly` has `time`, `temperature`, `condition`,
`precipitation_probability`, `precipitation_mm` and `wind_gust`.

Automations can trigger on any reading: `rain_soon` to close a skylight,
`freeze_tonight` to cover plants, `wind_gust` over 15 m/s, or `alert_level`
reaching 3. The device accepts no commands.

## Actions

| Action | Who can run it | Timeout | What it does |
|---|---|---|---|
| `status` | read only users and up | 5 s | Each place, where it is, whose warnings it gets, and when each reading was last fetched or why it failed. |
| `refresh` | any user | 5 s | Reads every place's weather and warnings now instead of waiting for the next turn. The page's **Refresh now** button runs it. |

## Alerts

Each warning in force becomes an alert on its place's device. It shows in
the house's alert list and on Home under Needs attention. It clears by
itself when the service withdraws it or it ends. When a service sends an
update to a warning, only the update is kept.

| Alert | Topic | Severity | On by default | Raised for |
|---|---|---|---|---|
| Weather warning | `weather_warning` | error | yes | A warning or emergency (tornado, flood, winter storm). MeteoAlarm orange or red. |
| Weather watch | `weather_watch` | warning | yes | A watch. MeteoAlarm yellow. |
| Weather advisory | `weather_advisory` | info | no | An advisory or statement (wind, fog, frost). |

For the National Weather Service, the kind follows the warning's name, so a
Flood Watch is a watch however severe the service rates it. Only a name
with none of those words falls back to the service's severity.

MeteoAlarm lists warnings by region, so a European place needs its region.
The National Weather Service is asked by the place's coordinates and needs
nothing more.

The plugin also shows notices on its page:

| Notice | Raised when |
|---|---|
| `no_house_location` | No places are set and homeCore didn't share the house's location within 5 seconds. |
| `place_not_found_<id>` | A place's postal code or name couldn't be looked up. |
| `warnings_off_<id>` | A place asked for MeteoAlarm without a country MeteoAlarm covers, or without a region. |
| `unreachable_open_meteo_<source>`, `unreachable_warnings_<source>` | A read keeps failing. The notice names the place and the reason. |

## Screens and cards

The plugin's page (**Settings › Plugins › Weather**) lists each place with
its current weather and any warnings in full (when each ends, the service's
description and what it says to do). It shows where each place is, which
service its warnings come from, and when each reading was last fetched or
why it couldn't be. **Refresh now** reads everything at once. The settings
are on the same page.

The plugin adds one dashboard card, **Weather, animated**, in compact,
standard and large sizes. Its settings pick the place and the name shown on
the card. It draws the current weather as a moving scene: drifting clouds,
rain or snow that falls harder in heavier rain and slants in the wind, sun
rays or a moon and stars, and lightning in a storm. On top it shows the
temperature, a ribbon when a watch or warning is in force, "Rain in 20 min"
when rain is due, the next few hours, and five days at the large size. The
animation stops when the card is off screen, and stays still for anyone
whose device is set to reduce motion.

The app's own **Weather** card also works with these devices. It shows the
temperature, humidity, how it feels, wind and gusts, and five days with each
day's sky. A Weather card not set to a particular device picks the house's
weather and prefers a device with a forecast over a weather station without
one.

## Troubleshooting

A failed read is tried again after 1 minute, then 2, 4, 8 and so on,
doubling each time but never waiting longer than the normal timer.
While a read keeps failing, a notice on the plugin's page names the place
and the reason, such as a refused connection or a timeout. Check that the
host can reach the internet.

If there is no `weather_home` device, look for the `no_house_location`
notice. Set homeCore's location, or add the house as a place.

If a European place shows no warnings, check its country and **MeteoAlarm
region**. The `warnings_off_<id>` notice says which one is missing.

When homeCore stops the plugin, it marks its devices offline before it exits.

## Known limits

- Warnings cover the US and Puerto Rico (National Weather Service) and the
  countries MeteoAlarm covers. Other places get weather but no warnings.
- Open-Meteo's free service is for non-commercial use.

## Data

Weather data by [Open-Meteo.com](https://open-meteo.com/), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Warnings come from
the US National Weather Service and [MeteoAlarm](https://meteoalarm.org/).
