export function accountEdit(actor,target,before,patch,operator) {
  if (!actor || !target || actor===target || before?.uid!==target || operator) throw Error('ADMIN_TARGET');
  const {plan,blocked,limits}=patch;
  if (!['free','premium'].includes(plan) || typeof blocked!=='boolean') throw Error('ADMIN_INVALID');
  const fields={plan,blocked};
  const event={actor,target,beforePlan:before.plan,afterPlan:plan,beforeBlocked:before.blocked,afterBlocked:blocked};
  if (limits!==undefined) {
    const {minute,day,month}=limits;
    if (Object.keys(limits).length!==3 || ![minute,day,month].every(Number.isSafeInteger) ||
          minute<1 || day<minute || month<day || month>10000) throw Error('ADMIN_LIMITS');
    if (minute!==before.limits?.minute || day!==before.limits?.day || month!==before.limits?.month) {
      fields.limits={minute,day,month};
      event.beforeLimits=before.limits??null;
      event.afterLimits=fields.limits;
    }
  }
  if (plan===before.plan && blocked===before.blocked && !fields.limits) throw Error('ADMIN_NO_CHANGE');
  return {fields,event};
}
