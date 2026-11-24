const groupUrl = 'https://ro-rasp.tpu.ru/gruppa_44645';
const academicYear = 2026;
const firstSunday = Date.UTC(2026, 7, 30);
const lastWeek = 51;
const weekInMilliseconds = 7 * 24 * 60 * 60 * 1000;

const tomskDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tomsk',
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const scheduleLink = document.getElementById('schedule');
const weekLabel = document.getElementById('week');

function updateSchedule() {
  const parts = Object.fromEntries(
    tomskDate.formatToParts(new Date()).map(({ type, value }) => [type, value]),
  );
  // Treat Tomsk calendar dates as UTC dates for arithmetic without local clock offsets.
  const calendarDay = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const week = 1 + Math.floor((calendarDay - firstSunday) / weekInMilliseconds);

  if (week >= 1 && week <= lastWeek) {
    scheduleLink.href = `${groupUrl}/${academicYear}/${week}/view.html`;
    scheduleLink.textContent = 'Открыть расписание';
    weekLabel.textContent = `Группа 8К53Т · Неделя ${week}`;
  } else {
    scheduleLink.href = 'https://ro-rasp.tpu.ru/';
    scheduleLink.textContent = 'Открыть портал ТПУ';
    weekLabel.textContent = 'Найдите группу 8К53Т на портале ТПУ.';
  }
  return scheduleLink.href;
}

updateSchedule();
scheduleLink.addEventListener('click', updateSchedule);

const pageUrl = new URL(location.href);
if (pageUrl.searchParams.has('setup')) {
  pageUrl.searchParams.delete('setup');
  // A bookmark created here opens the regular URL with automatic navigation.
  history.replaceState(null, '', pageUrl);
  document.getElementById('bookmark-help').hidden = false;
} else {
  document.getElementById('bookmark-option').hidden = false;
  setTimeout(() => location.replace(updateSchedule()), 1500);
}
