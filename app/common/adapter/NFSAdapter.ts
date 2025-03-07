import { Readable } from 'stream';
import {
  ContextProto,
  AccessLevel,
  Inject,
} from '@eggjs/tegg';
import { Pointcut } from '@eggjs/tegg/aop';
import { EggLogger } from 'egg';
import { NFSClientAdapter } from './NFSClientAdapter';
import { AsyncTimer } from '../aop/AsyncTimer';

const INSTANCE_NAME = 'nfsAdapter';

@ContextProto({
  name: INSTANCE_NAME,
  accessLevel: AccessLevel.PUBLIC,
})
export class NFSAdapter {
  @Inject()
  private readonly nfsClientAdapter: NFSClientAdapter;

  @Inject()
  private readonly logger: EggLogger;

  @Pointcut(AsyncTimer)
  async uploadBytes(storeKey: string, bytes: Uint8Array) {
    this.logger.info('[%s:uploadBytes] key: %s, bytes: %d', INSTANCE_NAME, storeKey, bytes.length);
    if (this.nfsClientAdapter.client.uploadBytes) {
      return await this.nfsClientAdapter.client.uploadBytes(bytes, { key: storeKey });
    }
    await this.nfsClientAdapter.client.uploadBuffer(bytes, { key: storeKey });
  }

  // will return next store position
  @Pointcut(AsyncTimer)
  async appendBytes(storeKey: string, bytes: Uint8Array, position?: string, headers?: object) {
    let result;
    // make sure position is undefined by the first time
    if (!position) position = undefined;
    const options = {
      key: storeKey,
      position,
      headers,
    };
    if (this.nfsClientAdapter.client.appendBytes) {
      result = await this.nfsClientAdapter.client.appendBytes(bytes, options);
    } else {
      result = await this.nfsClientAdapter.client.appendBuffer(bytes, options);
    }
    if (result?.nextAppendPosition) return String(result.nextAppendPosition);
  }

  @Pointcut(AsyncTimer)
  async uploadFile(storeKey: string, file: string) {
    this.logger.info('[%s:uploadFile] key: %s, file: %s', INSTANCE_NAME, storeKey, file);
    await this.nfsClientAdapter.client.upload(file, { key: storeKey });
  }

  @Pointcut(AsyncTimer)
  async remove(storeKey: string) {
    this.logger.info('[%s:remove] key: %s, file: %s', INSTANCE_NAME, storeKey);
    await this.nfsClientAdapter.client.remove(storeKey);
  }

  @Pointcut(AsyncTimer)
  async getStream(storeKey: string): Promise<Readable | undefined> {
    return await this.nfsClientAdapter.client.createDownloadStream(storeKey);
  }

  @Pointcut(AsyncTimer)
  async getBytes(storeKey: string): Promise<Uint8Array | undefined> {
    return await this.nfsClientAdapter.client.readBytes(storeKey);
  }

  @Pointcut(AsyncTimer)
  async getDownloadUrl(storeKey: string): Promise<string | undefined> {
    if (typeof this.nfsClientAdapter.client.url === 'function') {
      return this.nfsClientAdapter.client.url(storeKey) as string;
    }
  }

  async getDownloadUrlOrStream(storeKey: string): Promise<string | Readable | undefined> {
    const downloadUrl = await this.getDownloadUrl(storeKey);
    if (downloadUrl) {
      return downloadUrl;
    }
    return await this.getStream(storeKey);
  }
}
