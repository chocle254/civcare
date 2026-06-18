import client from './client';

export const startVideo    = (data) => client.post('/video/start', data);
export const getVideoRoom  = (consultationId) =>
  client.get(`/video/room?consultation_id=${consultationId}`);
