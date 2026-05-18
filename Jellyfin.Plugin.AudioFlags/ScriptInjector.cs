using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.AudioFlags;

public class ScriptInjector : IHostedService
{
    private const string Marker = "<!-- AudioFlags-Injected -->";
    private const string Tag = "<script defer src=\"/AudioFlags/ClientScript\"></script>";
    private readonly IApplicationPaths _paths;
    private readonly ILogger<ScriptInjector> _log;

    public ScriptInjector(IApplicationPaths paths, ILogger<ScriptInjector> log)
    {
        _paths = paths;
        _log = log;
    }

    public Task StartAsync(CancellationToken ct)
    {
        try
        {
            var indexPath = Path.Combine(_paths.WebPath, "index.html");
            if (!File.Exists(indexPath))
            {
                _log.LogWarning("AudioFlags: index.html not found at {Path}", indexPath);
                return Task.CompletedTask;
            }

            var html = File.ReadAllText(indexPath);
            if (html.Contains(Marker, StringComparison.Ordinal))
            {
                _log.LogDebug("AudioFlags: script already injected");
                return Task.CompletedTask;
            }

            var injection = Marker + "\n" + Tag + "\n";
            var idx = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            html = idx < 0 ? html + injection : html.Insert(idx, injection);

            File.WriteAllText(indexPath, html);
            _log.LogInformation("AudioFlags: injected client script into {Path}", indexPath);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "AudioFlags: failed to inject script");
        }

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
