"use client";

import { createContext, useActionState, useContext, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormAction, FormState } from "@/types/auth";

const ResultContext = createContext<FormState>(null);
function Submit({label}: {label:string}) {
  const {pending} = useFormStatus();
  return <button className="button button-primary form-submit" type="submit" disabled={pending}>{pending ? "처리 중…" : label}</button>;
}
export function ActionForm({action,submitLabel,children}: {action:FormAction;submitLabel:string;children:ReactNode}) {
  const alert = useRef<HTMLDivElement>(null);
  const [state,formAction,pending] = useActionState(action,null);
  return <ResultContext value={state}><form action={formAction} className="account-form" aria-busy={pending}>
    {children}
    <div ref={alert} className="form-feedback" role={state && !state.ok ? "alert" : "status"} aria-live="polite" tabIndex={-1}>
      {state ? state.ok ? <p className="form-success">{state.data.message}</p> : <><p>{state.error.message}</p>{state.error.fieldErrors ? <ul>{Object.entries(state.error.fieldErrors).map(([key,messages]) => <li key={key}>{messages.join(" ")}</li>)}</ul> : null}</> : null}
    </div>
    <Submit label={submitLabel}/>
  </form></ResultContext>;
}
type FieldProps = {label:string;hint?:string;children?:ReactNode} & Omit<ComponentProps<"input">,"id"|"children">;
export function Field({label,hint,children,...props}:FieldProps) {
  const id = useId(); const state = useContext(ResultContext);
  const messages = state && !state.ok ? state.error.fieldErrors?.[props.name ?? ""] : undefined;
  return <div className="form-field"><label htmlFor={id}>{label}</label>{children ? children : <input {...props} id={id} aria-invalid={Boolean(messages)} aria-describedby={hint || messages ? `${id}-help` : undefined}/>}
    {hint || messages ? <p id={`${id}-help`} className={messages ? "field-error" : "field-hint"}>{messages?.join(" ") ?? hint}</p> : null}
  </div>;
}
export function Checkbox({name,label,defaultChecked=false,required=false}: {name:string;label:ReactNode;defaultChecked?:boolean;required?:boolean}) {
  return <label className="form-checkbox"><input name={name} type="checkbox" defaultChecked={defaultChecked} required={required}/><span>{label}</span></label>;
}
export function Textarea({name,label,defaultValue="",maxLength=160,readOnly=false}: {name:string;label:string;defaultValue?:string;maxLength?:number;readOnly?:boolean}) {
  const id = useId(); const state = useContext(ResultContext);
  const error = state && !state.ok ? state.error.fieldErrors?.[name] : undefined;
  return <div className="form-field"><label htmlFor={id}>{label}</label><textarea id={id} name={name} defaultValue={defaultValue} maxLength={maxLength} readOnly={readOnly} rows={3} aria-invalid={Boolean(error)}/>{error ? <p className="field-error">{error.join(" ")}</p> : null}</div>;
}
export function Select({name,label,defaultValue,children}: {name:string;label:string;defaultValue?:string;children:ReactNode}) {
  const id = useId();
  return <div className="form-field"><label htmlFor={id}>{label}</label><select id={id} name={name} defaultValue={defaultValue}>{children}</select></div>;
}
