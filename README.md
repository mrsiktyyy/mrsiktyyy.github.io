# Music — mrsiktyyy.github.io

Статичный «YouTube Music»-подобный плеер для GitHub Pages.

## Структура (положить в корень репозитория `mrsiktyyy.github.io`)
```
index.html
tracks.json
css/style.css
js/app.js
.nojekyll
Атлантида.mp3
РепЛовушки.mp3
Семья.mp3
ВойнаВРепе.mp3
```
## Как добавить песню
1. Загрузить `Название.mp3` в корень репозитория.
2. Добавить строку в `tracks.json`: `{ "id": 5, "title": "Название", "artist": "mrsiktyyy", "file": "Название.mp3" }`
3. Commit → через минуту сайт обновится.

Имена файлов в `tracks.json` должны совпадать с реальными (регистр важен!).
Горячие клавиши: Space — пауза, Shift+←/→ — трек назад/вперёд.
