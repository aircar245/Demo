
import { api } from './client';
export type Rule = Record<string, unknown>;
export interface Definition {id:number;key:string;name:string;description:string;color:string;icon:string;rare:number;sortOrder:number;type:string;condition:Rule}
export interface Job {id:string;state:string;total:number;processed:number;created:number;error:string|null}
export const listAchievements = async () => (await api.get<{list:Definition[]}>('/achievement/getlist')).data.list;
export const ruleMetadata = async () => (await api.get<{events:string[];metrics:string[];operators:string[];tables:Record<string,string[]>}>('/achievement/metadata')).data;
export const saveAchievement = async (item:Omit<Definition,'id'>,id?:number) => (await api.post(id ? '/achievement/update/'+id : '/achievement/add',item)).data;
export const deleteAchievement = async (id:number) => api.post('/achievement/delete/'+id);
export const grantAchievement = async (id:number,userId:number) => (await api.post<{created:boolean}>('/achievement/unlock',{id,userId})).data;
export const validateRule = async (condition:Rule) => (await api.post<{backfillable:boolean}>('/achievement/validate',{condition})).data;
export const previewBackfill = async (id:number) => (await api.post<{job:Job}>('/achievement/backfill/preview/'+id)).data.job;
export const startBackfill = async (id:string) => (await api.post<{job:Job}>('/achievement/backfill/start/'+id)).data.job;
export const getBackfill = async (id:string) => (await api.get<{job:Job}>('/achievement/backfill/'+id)).data.job;
