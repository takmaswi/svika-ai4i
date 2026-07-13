// The demo and story doors post here as a plain HTML form, not a React server
// action. A server action invoked before the page hydrates (the first tap on a
// slow phone) 500s on Next 15.1 with "cookies was called outside a request
// scope"; a route handler runs in normal request scope, so the front door works
// with or without JavaScript. enterDemo does the sign in and always redirects;
// the fallthrough only fires if it ever returns without one.
import { enterDemo } from "@/lib/demo-actions";

export async function POST(req: Request): Promise<Response> {
  const formData = await req.formData();
  await enterDemo(formData);
  return Response.redirect(new URL("/?demoerr=1", req.url), 303);
}
