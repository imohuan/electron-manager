import iconv from "iconv-lite";

export const decode = (data: any, encoding: string = "cp936") =>
  iconv.decode(Buffer.from(data, "binary"), encoding);

export const encode = (str: any, encoding: string = "gbk") => iconv.encode(str, encoding);
