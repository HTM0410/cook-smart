// Stub module kept only to satisfy stale TypeScript references in legacy controllers.
// The runtime uses python subprocess instead of importing this file.
export const _trigger_code_pipeline: (...args: any[]) => Promise<any> = async () => {
  throw new Error('mlops/serving/promotion is a stub; runtime uses Python subprocess');
};
export const _promote_wandb: (...args: any[]) => Promise<any> = async () => {
  throw new Error('mlops/serving/promotion is a stub; runtime uses Python subprocess');
};
export default {};