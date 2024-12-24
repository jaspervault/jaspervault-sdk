import { createLogger, format, transports } from 'winston';
import util from 'util';

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.colorize(), // 添加颜色
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message, ...meta }) => {
            // 使用 util.inspect 格式化 message 和 meta
            const formattedMessage = typeof message === 'object' ? util.inspect(message, { colors: true, depth: undefined }) : message;
            const formattedMeta = Object.keys(meta).length ? util.inspect(meta, { colors: true, depth: undefined }) : '';
            return `${timestamp} [${level}]: ${formattedMessage} ${formattedMeta}`;
        })
    ),
    transports: [
        new transports.Console(),
        // Add other transports here (e.g., File, HTTP)
    ],
});

export default logger;