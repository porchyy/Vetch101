mod network {
    use vetch101_lib::engine::metadata::fetch_video_metadata;

    #[test]
    fn test_fetch_metadata_real_url() {
        let res = fetch_video_metadata("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
        assert!(res.is_ok(), "Failed to fetch metadata: {:?}", res.err());
        let meta = res.unwrap();
        assert_eq!(meta.id, "aqz-KE-bpKQ");
        assert!(meta.title.contains("Big Buck Bunny"));
        assert!(meta
            .qualities
            .iter()
            .any(|q| q.id == "audio" && q.ext == "mp3"));
        assert!(meta.qualities.iter().any(|q| q.ext == "mp4"));
    }
}
