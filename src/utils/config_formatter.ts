
interface WriterSetting {
    symbol: string;
    callAddress: string;
    putAddress: string;
}

export function transformWriterSettings(settings: WriterSetting[], chain: string): any {
    const result = {};
    result[chain] = {
        'CALL': {},
        'PUT': {},
    };

    settings.forEach(setting => {
        if (setting.symbol && setting.callAddress && setting.callAddress !== '0x0000000000000000000000000000000000000000') {
            result[chain]['CALL'][setting.symbol] = setting.callAddress;
        }
        if (setting.symbol && setting.putAddress && setting.putAddress !== '0x0000000000000000000000000000000000000000') {
            result[chain]['PUT'][setting.symbol] = setting.putAddress;
        }
    });

    return result;
}