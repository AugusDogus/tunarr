import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import tz from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(duration);
dayjs.extend(tz);
dayjs.extend(utc);

export default dayjs;
