using System.Reflection;
using System.Text.Json;
using Jellyfin.Plugin.AudioFlags.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.AudioFlags.Api;

[ApiController]
[Route("AudioFlags")]
[AllowAnonymous]
public class AudioFlagsController : ControllerBase
{
    [HttpGet("ClientScript")]
    [Produces("application/javascript")]
    public ActionResult GetClientScript()
    {
        var asm = Assembly.GetExecutingAssembly();
        var resName = "Jellyfin.Plugin.AudioFlags.Web.audio-flags.js";
        var stream = asm.GetManifestResourceStream(resName);
        if (stream == null) return NotFound();
        return File(stream, "application/javascript; charset=utf-8");
    }

    [HttpGet("Config")]
    [Produces("application/json")]
    public ActionResult GetClientConfig()
    {
        var cfg = Plugin.Instance?.Configuration ?? new PluginConfiguration();
        var payload = new
        {
            showAudio = cfg.ShowAudio,
            showSubtitles = cfg.ShowSubtitles,
            englishUsesGB = cfg.EnglishUsesGB,
            debug = cfg.DebugLogging
        };
        return Content(JsonSerializer.Serialize(payload), "application/json");
    }
}
