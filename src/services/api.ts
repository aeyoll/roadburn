import ky from 'ky';
import type { FestivalDashboard } from '@/types/festival';

const API_BASE = 'https://jp.bidega.in/';

interface ApiResponse {
  data: FestivalDashboard;
}

export async function fetchFestivalDashboard(): Promise<FestivalDashboard> {
  const response = await ky.get(`${API_BASE}roadburn.json`).json<ApiResponse>();

  return response.data;
}
