import{StrictMode}from"react";import{createRoot}from"react-dom/client";import Home from"../app/page";import"../app/globals.css";import{installPaperPersistenceGuard,restorePaperConfig}from"../lib/paper-persistence";

async function bootstrap(){
 await restorePaperConfig();
 installPaperPersistenceGuard();
 createRoot(document.getElementById("root")!).render(<StrictMode><Home/></StrictMode>);
 if("serviceWorker"in navigator){const register=()=>navigator.serviceWorker.register("./sw.js");if(document.readyState==="complete")void register();else window.addEventListener("load",()=>{void register()},{once:true})}
}
void bootstrap();
