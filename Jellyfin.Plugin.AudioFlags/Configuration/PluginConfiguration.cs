using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.AudioFlags.Configuration;

public class PluginConfiguration : BasePluginConfiguration
{
    public bool ShowAudio { get; set; } = true;
    public bool ShowSubtitles { get; set; } = true;
    public bool EnglishUsesGB { get; set; } = true;
    public bool DebugLogging { get; set; } = false;
}
