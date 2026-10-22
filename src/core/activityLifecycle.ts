export type ActivityInstance<T> = {
  getId(): string;
  update(props: T, staleDate: Date): Promise<void>;
  end(policy: 'immediate', props: T, date: Date): Promise<void>;
};
export async function reconcileActivities<T>(
  instances: ActivityInstance<T>[], mapping: Record<string,string>,
  desired: {presetId:string;props:T;openUrl:string}[],
  options: {renew:boolean;endedProps:T;staleDate:Date;start(props:T,url:string,date:Date):ActivityInstance<T>},
): Promise<Record<string,string>> {
  const keep = new Set(options.renew ? [] : desired.map(entry=>mapping[entry.presetId]).filter(Boolean));
  for (const instance of instances.filter(entry=>!keep.has(entry.getId()))) {
    // A failed end must not be followed by a second live copy of that activity.
    await instance.end('immediate',options.endedProps,new Date());
  }
  const next:Record<string,string>={};
  for (const entry of desired) {
    const existing=options.renew?undefined:instances.find(instance=>instance.getId()===mapping[entry.presetId]);
    if(existing) {await existing.update(entry.props,options.staleDate);next[entry.presetId]=existing.getId();}
    else next[entry.presetId]=options.start(entry.props,entry.openUrl,options.staleDate).getId();
  }
  return next;
}
