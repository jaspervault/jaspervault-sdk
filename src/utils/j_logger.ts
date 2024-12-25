import util from 'util';

const levels = ['error', 'warn', 'info', 'debug'];

const logger = levels.reduce((acc, level) => {
    acc[level] = (message: any, ...meta: any[]) => {
        const timestamp = new Date().toISOString();
        const formattedMessage = typeof message === 'object' ? util.inspect(message, { colors: true, depth: undefined }) : message;
        const formattedMeta = meta.length ? meta.map(m => util.inspect(m, { colors: true, depth: undefined })).join(' ') : '';
        console.log(`${timestamp} [${level.toUpperCase()}]: ${formattedMessage} ${formattedMeta}`);
    };
    return acc;
}, {} as Record<string, (message: any, ...meta: any[]) => void>);

export default logger;