import { fetch } from 'expo/fetch';
import { origins } from './origins';
import { createRequestClient, type Transport } from './requestClient';

export const request = createRequestClient(origins.connection, fetch as Transport);
