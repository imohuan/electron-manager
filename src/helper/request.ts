import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { defaultsDeep } from "lodash-es";

interface CustomConfig {
  retry: number;
  delay: number;
  urls: string[];
}

type RequestConfig = AxiosRequestConfig & Partial<CustomConfig>;

export async function request(
  option: RequestConfig,
  callback: (response: AxiosResponse) => Promise<any>
): Promise<any> {
  return new Promise((_resolve) => {
    defaultsDeep(option, { retry: 3, delay: 1000 } as RequestConfig);
    if (option?.urls) {
      option.url = option.urls.shift();
      if (option.urls.length === 0) delete option.urls;
    }
    axios(option)
      .then(callback)
      .then((data) => {
        if (data) return _resolve(data);
        if (option.retry! <= 0) return _resolve(false);
        setTimeout(async () => {
          const result = await request(
            defaultsDeep({ retry: option.retry! - 1 }, option),
            callback
          );
          _resolve(result);
        }, option.delay);
      });
  });
}
